import { detectLocalTools, loadConfig, projectRoot } from "@agent-governor/config";
import { migrate, openDb, type GovernorDb } from "@agent-governor/db";
import { WorkflowEngine } from "@agent-governor/workflow";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execa } from "execa";

type WorkerState = {
  nodeId: string;
  token: string;
};

type RegisteredNodeResponse = {
  ok: boolean;
  token?: string;
  node?: { id: string };
  error?: string;
};

const root = projectRoot(process.cwd());
const config = workerConfig();
const controlPlaneUrl = (process.env.AG_CONTROL_PLANE_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
const statePath = process.env.AG_WORKER_STATE_PATH ?? resolve(root, "data", "worker-node.json");
const pollMs = Number(process.env.AG_WORKER_POLL_MS ?? "10000");
const repoAllowlist = splitEnvList(process.env.AG_WORKER_REPO_ALLOWLIST);
const workerDataRoot = process.env.AG_WORKER_DATA_ROOT ?? resolve(root, "data", "worker");
const workerName = process.env.AG_WORKER_NAME ?? `${hostname()} worker`;
const preferredRuntime = process.env.AG_WORKER_RUNTIME;
const executeClaims = process.env.AG_WORKER_DISABLE_EXECUTION !== "true";

const localTools = detectLocalTools(config.agents);
const runnableTools = localTools.filter((tool) => tool.promptRunnable);
const state = await loadOrRegisterWorker();
let heartbeatInFlight = false;
let pollInFlight = false;

console.log("Agent Governor worker started");
console.log(`Control plane: ${controlPlaneUrl}`);
console.log(`Node: ${state.nodeId}`);
console.log(`Detected runtimes: ${runnableTools.map((tool) => tool.id).join(", ") || "none"}`);
console.log(`Execution: ${executeClaims ? "enabled" : "disabled"}`);

await heartbeat();
await pollOnce();
setInterval(() => {
  if (heartbeatInFlight) return;
  heartbeatInFlight = true;
  heartbeat()
    .catch((error) => console.error(`heartbeat failed: ${error instanceof Error ? error.message : String(error)}`))
    .finally(() => {
      heartbeatInFlight = false;
    });
}, 30_000);
setInterval(() => {
  if (pollInFlight) return;
  pollInFlight = true;
  pollOnce()
    .catch((error) => console.error(`poll failed: ${error instanceof Error ? error.message : String(error)}`))
    .finally(() => {
      pollInFlight = false;
    });
}, Math.max(2_000, pollMs));

async function loadOrRegisterWorker(): Promise<WorkerState> {
  if (process.env.AG_WORKER_NODE_ID && process.env.AG_WORKER_NODE_TOKEN) {
    return { nodeId: process.env.AG_WORKER_NODE_ID, token: process.env.AG_WORKER_NODE_TOKEN };
  }

  const stored = readWorkerState();
  if (stored) return stored;

  const response = await postJson<RegisteredNodeResponse>("/api/nodes", {
    name: workerName,
    mode: process.env.AG_WORKER_MODE ?? "desktop",
    capabilities: [...new Set(runnableTools.flatMap((tool) => tool.capabilities))],
    runtimes: runnableTools.map((tool) => tool.id),
    repoAllowlist
  });
  if (!response.ok || !response.node?.id || !response.token) {
    throw new Error(response.error ?? "worker registration failed");
  }
  const nextState = { nodeId: response.node.id, token: response.token };
  writeWorkerState(nextState);
  return nextState;
}

async function heartbeat() {
  await postJson("/api/nodes/heartbeat", {
    status: "online",
    capabilities: [...new Set(runnableTools.flatMap((tool) => tool.capabilities))],
    runtimes: runnableTools.map((tool) => tool.id),
    repoAllowlist
  }, state.token);
}

async function pollOnce() {
  const result = await postJson<{
    ok: boolean;
    claimed?: boolean;
    claim?: { id: number; status: string; claimedAt: string };
    task?: ClaimedTask;
    error?: string;
  }>(
    "/api/nodes/claim",
    {},
    state.token
  );
  if (!result.ok) {
    throw new Error(result.error ?? "task claim failed");
  }
  if (!result.claimed || !result.task) return;
  console.log(`Claimed TASK-${result.task.id}: ${result.task.title}`);
  await postJson("/api/nodes/events", {
    taskId: result.task.id,
    eventType: "worker.claim_received",
    message: `Worker ${state.nodeId} received TASK-${result.task.id}`,
    metadata: { repo: result.task.repo ?? null }
  }, state.token);
  if (!executeClaims || !result.claim?.id) {
    return;
  }
  await executeClaim(result.claim.id, result.task);
}

async function executeClaim(claimId: number, claimedTask: ClaimedTask) {
  const taskId = claimedTask.id;
  const startedAt = Date.now();
  let mirroredTask: { branch_name: string | null; worktree_path: string | null; pr_url: string | null; status: string; current_stage: string | null } | null = null;
  try {
    await postJson("/api/nodes/events", {
      taskId,
      eventType: "worker.execution_started",
      message: `Worker ${state.nodeId} started TASK-${taskId}`,
      metadata: { preferredRuntime: preferredRuntime ?? null }
    }, state.token);
    const db = openDb(config.app.paths.database);
    try {
      migrate(db);
      await prepareClaimedTaskWorkspace(db, claimedTask);
      const workflow = new WorkflowEngine({ db, config });
      const task = claimedTask.status === "WAITING_PR_APPROVAL"
        ? await workflow.openApprovedPullRequest(taskId, `worker:${state.nodeId}`)
        : await workflow.advance(taskId, `worker:${state.nodeId}`, {
            runtimeId: preferredRuntime
          });
      mirroredTask = {
        branch_name: task.branch_name,
        worktree_path: task.worktree_path,
        pr_url: task.pr_url,
        status: task.status,
        current_stage: task.current_stage
      };
      await postJson(`/api/nodes/claims/${claimId}`, {
        status: "completed",
        result: {
          taskId,
          taskStatus: task.status,
          currentStage: task.current_stage,
          prUrl: task.pr_url,
          branchName: task.branch_name,
          worktreePath: task.worktree_path,
          elapsedMs: Date.now() - startedAt
        }
      }, state.token);
      await postJson("/api/nodes/events", {
        taskId,
        eventType: "worker.execution_completed",
        message: claimedTask.status === "WAITING_PR_APPROVAL"
          ? `Worker ${state.nodeId} opened PR for TASK-${taskId}`
          : `Worker ${state.nodeId} advanced TASK-${taskId} to ${task.status}`,
        metadata: { currentStage: task.current_stage, prUrl: task.pr_url, elapsedMs: Date.now() - startedAt }
      }, state.token);
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await postJson(`/api/nodes/claims/${claimId}`, {
      status: "failed",
      result: {
        taskId,
        error: message,
        taskStatus: mirroredTask?.status,
        currentStage: mirroredTask?.current_stage,
        prUrl: mirroredTask?.pr_url,
        elapsedMs: Date.now() - startedAt
      }
    }, state.token);
    await postJson("/api/nodes/events", {
      taskId,
      eventType: "worker.execution_failed",
      message,
      metadata: { elapsedMs: Date.now() - startedAt }
    }, state.token);
    console.error(`TASK-${taskId} failed: ${message}`);
  }
}

type ClaimedTask = {
  id: number;
  title: string;
  description: string;
  status?: string;
  workflow?: string;
  createdBy?: string;
  repoId?: number;
  branchName?: string | null;
  worktreePath?: string | null;
  repo?: {
    id?: number;
    name: string;
    owner: string;
    repo: string;
    defaultBranch: string;
  } | null;
};

type RepoTokenResponse = {
  ok: boolean;
  provider?: string;
  owner?: string;
  repo?: string;
  expiresAt?: string;
  git?: {
    remoteUrl: string;
    extraHeader?: string;
  };
  error?: string;
};

async function prepareClaimedTaskWorkspace(db: GovernorDb, task: ClaimedTask) {
  if (!task.repo) {
    throw new Error(`TASK-${task.id} does not include repository context`);
  }
  const repoId = task.repoId ?? task.repo.id ?? task.id;
  const localPath = await ensureRepoClone(task);
  upsertWorkerRepo(db, {
    id: repoId,
    name: task.repo.name,
    owner: task.repo.owner,
    repo: task.repo.repo,
    defaultBranch: task.repo.defaultBranch,
    localPath
  });
  upsertWorkerTask(db, {
    id: task.id,
    repoId,
    createdBy: task.createdBy ?? "remote",
    title: task.title,
    description: task.description,
    status: task.status ?? "NEW",
    workflow: task.workflow ?? "default",
    branchName: task.branchName ?? null,
    worktreePath: task.worktreePath && existsSync(task.worktreePath) ? task.worktreePath : null
  });
  mirrorClaimApproval(db, task);
}

async function ensureRepoClone(task: ClaimedTask): Promise<string> {
  const repo = task.repo;
  if (!repo) throw new Error(`TASK-${task.id} does not include repository context`);
  const token = await requestRepoToken(task);
  const repoPath = resolve(workerDataRoot, "repos", repo.owner, repo.repo, repo.defaultBranch);
  mkdirSync(dirname(repoPath), { recursive: true });
  const gitConfig = token.git?.extraHeader ? ["-c", `http.extraHeader=${token.git.extraHeader}`] : [];
  if (!existsSync(join(repoPath, ".git"))) {
    await postJson("/api/nodes/events", {
      taskId: task.id,
      eventType: "worker.repo_clone_started",
      message: `Worker ${state.nodeId} cloning ${repo.owner}/${repo.repo}`,
      metadata: { repo: `${repo.owner}/${repo.repo}`, provider: token.provider, expiresAt: token.expiresAt }
    }, state.token);
    await execa("git", [...gitConfig, "clone", "--branch", repo.defaultBranch, token.git?.remoteUrl ?? "", repoPath], { stdio: "inherit" });
  } else {
    await execa("git", [...gitConfig, "-C", repoPath, "fetch", "origin", repo.defaultBranch], { stdio: "inherit" });
    await execa("git", ["-C", repoPath, "checkout", repo.defaultBranch], { stdio: "inherit" });
    await execa("git", ["-C", repoPath, "reset", "--hard", `origin/${repo.defaultBranch}`], { stdio: "inherit" });
  }
  if (token.git?.extraHeader) {
    await execa("git", ["-C", repoPath, "config", "http.extraHeader", token.git.extraHeader], { reject: false });
    const bearer = token.git.extraHeader.match(/^Authorization:\s*Bearer\s+(.+)$/i)?.[1];
    if (bearer) {
      process.env.GH_TOKEN = bearer;
    }
  }
  await execa("git", ["-C", repoPath, "config", "user.email", process.env.AG_WORKER_GIT_EMAIL ?? "agent-governor-worker@example.invalid"], { reject: false });
  await execa("git", ["-C", repoPath, "config", "user.name", process.env.AG_WORKER_GIT_NAME ?? "Agent Governor Worker"], { reject: false });
  return repoPath;
}

async function requestRepoToken(task: ClaimedTask): Promise<RepoTokenResponse> {
  const repo = task.repo;
  if (!repo) throw new Error(`TASK-${task.id} does not include repository context`);
  const token = await postJson<RepoTokenResponse>("/api/nodes/github-token", {
    taskId: task.id,
    owner: repo.owner,
    repo: repo.repo
  }, state.token);
  if (!token.ok || !token.git?.remoteUrl) {
    throw new Error(token.error ?? `Failed to get Git token for ${repo.owner}/${repo.repo}`);
  }
  return token;
}

function upsertWorkerRepo(db: GovernorDb, input: { id: number; name: string; owner: string; repo: string; defaultBranch: string; localPath: string }) {
  db.prepare(
    `INSERT INTO repos (id, name, github_owner, github_repo, default_branch, local_path, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       github_owner = excluded.github_owner,
       github_repo = excluded.github_repo,
       default_branch = excluded.default_branch,
       local_path = excluded.local_path,
       active = 1`
  ).run(input.id, input.name, input.owner, input.repo, input.defaultBranch, input.localPath, new Date().toISOString());
}

function upsertWorkerTask(db: GovernorDb, input: {
  id: number;
  repoId: number;
  createdBy: string;
  title: string;
  description: string;
  status: string;
  workflow: string;
  branchName: string | null;
  worktreePath: string | null;
}) {
  db.prepare(
    `INSERT INTO tasks (id, repo_id, created_by, title, description, status, workflow, current_stage, branch_name, worktree_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       repo_id = excluded.repo_id,
       title = excluded.title,
       description = excluded.description,
       status = excluded.status,
       workflow = excluded.workflow,
       branch_name = COALESCE(excluded.branch_name, tasks.branch_name),
       worktree_path = COALESCE(excluded.worktree_path, tasks.worktree_path),
       updated_at = excluded.updated_at`
  ).run(
    input.id,
    input.repoId,
    input.createdBy,
    input.title,
    input.description,
    input.status,
    input.workflow,
    input.branchName,
    input.worktreePath,
    new Date().toISOString(),
    new Date().toISOString()
  );
}

function mirrorClaimApproval(db: GovernorDb, task: ClaimedTask) {
  const stage = task.status === "WAITING_REQUIREMENTS_APPROVAL"
    ? "requirements"
    : task.status === "WAITING_DESIGN_APPROVAL"
      ? "design"
      : task.status === "WAITING_PR_APPROVAL"
        ? "pr"
        : null;
  if (!stage) return;
  const existing = db.prepare(
    "SELECT id FROM approvals WHERE task_id = ? AND stage = ? AND status = 'approved' LIMIT 1"
  ).get(task.id, stage);
  if (existing) return;
  db.prepare(
    `INSERT INTO approvals (task_id, stage, status, requested_by, approved_by, comment, created_at)
     VALUES (?, ?, 'approved', 'control-plane', 'control-plane', 'Mirrored from an authorized worker claim', ?)`
  ).run(task.id, stage, new Date().toISOString());
}

async function postJson<T = { ok: boolean; error?: string }>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${controlPlaneUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({ ok: false, error: `${response.status} ${response.statusText}` }));
  if (!response.ok && typeof data === "object" && data && "error" in data) {
    return data as T;
  }
  return data as T;
}

function readWorkerState(): WorkerState | null {
  if (!existsSync(statePath)) return null;
  const data = JSON.parse(readFileSync(statePath, "utf8")) as Partial<WorkerState>;
  if (!data.nodeId || !data.token) return null;
  return { nodeId: data.nodeId, token: data.token };
}

function writeWorkerState(state: WorkerState) {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function splitEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function workerConfig() {
  const loaded = loadConfig(root);
  if (process.env.AG_WORKER_SMOKE_RUNTIME !== "true") {
    return loaded;
  }
  return {
    ...loaded,
    agents: {
      ...loaded.agents,
      agents: loaded.agents.agents.map((agent) => ({
        ...agent,
        enabled: agent.id === "shell",
        configuredEnabled: agent.id === "shell"
      })),
      roles: Object.fromEntries(
        Object.entries(loaded.agents.roles).map(([role, route]) => [
          role,
          { preferred: ["shell"], fallback: route.fallback.filter((id) => id === "shell") }
        ])
      )
    }
  };
}

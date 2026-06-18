import { detectLocalTools, loadConfig, projectRoot } from "@agent-governor/config";
import { migrate, openDb } from "@agent-governor/db";
import { WorkflowEngine } from "@agent-governor/workflow";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";

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
    task?: { id: number; title: string; repo?: { owner: string; repo: string } | null };
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
  await executeClaim(result.claim.id, result.task.id);
}

async function executeClaim(claimId: number, taskId: number) {
  const startedAt = Date.now();
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
      const task = await new WorkflowEngine({ db, config }).advance(taskId, `worker:${state.nodeId}`, {
        runtimeId: preferredRuntime
      });
      await postJson(`/api/nodes/claims/${claimId}`, {
        status: "completed",
        result: {
          taskId,
          taskStatus: task.status,
          currentStage: task.current_stage,
          elapsedMs: Date.now() - startedAt
        }
      }, state.token);
      await postJson("/api/nodes/events", {
        taskId,
        eventType: "worker.execution_completed",
        message: `Worker ${state.nodeId} advanced TASK-${taskId} to ${task.status}`,
        metadata: { currentStage: task.current_stage, elapsedMs: Date.now() - startedAt }
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

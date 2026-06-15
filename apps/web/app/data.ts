import { detectLocalTools, loadConfig } from "@agent-governor/config";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

export interface DashboardData {
  tasks: Array<{ id: number; title: string; description: string; repo: string; status: string; stage: string | null; runtime: string; pr: string | null }>;
  approvals: Array<{ taskId: number; stage: string; status: string }>;
  runtimes: Array<{ id: string; label: string; type: string; enabled: boolean; configuredEnabled: boolean; detected: boolean; detectedCommand: string | null; command: string | null; args: string[]; models: string[]; defaultModel: string | null; executionMode: "headless" | "interactive"; capabilities: string[]; preferredRoles: string[]; promptSelectable: boolean; marketSummary: string | null; marketRank: number | null }>;
  roles: Array<{ id: string; preferred: string[]; fallback: string[] }>;
  localTools: ReturnType<typeof detectLocalTools>;
  repos: Array<{ id: number; name: string; github: string }>;
  githubRepos: Array<{ id: number; nameWithOwner: string; description: string; visibility: string; defaultBranch: string; url: string; updatedAt: string }>;
}

export interface TaskDetailData {
  task: {
    id: number;
    title: string;
    description: string;
    repo: string;
    status: string;
    stage: string | null;
    branch: string | null;
    worktree: string | null;
    pr: string | null;
  } | null;
  artifacts: Array<{ name: string; content: string }>;
  approvals: Array<{ stage: string; status: string; approvedBy: string | null; comment: string | null; createdAt: string }>;
  diff: { status: string; stat: string; patch: string } | null;
  runs: Array<{
    stage: string;
    role: string;
    runtimeId: string;
    status: string;
    logsPath: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
    prompt: string;
    stdout: string;
    stderr: string;
  }>;
  runtimes: DashboardData["runtimes"];
}

function gitOutput(worktree: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", worktree, ...args], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }).trim();
  } catch {
    return "";
  }
}

function getWorktreeDiff(worktree: string | null | undefined): TaskDetailData["diff"] {
  if (!worktree || !existsSync(worktree)) {
    return null;
  }
  const pathspec = [".", ":!.ai"];
  return {
    status: gitOutput(worktree, ["status", "--short", "--", ...pathspec]),
    stat: gitOutput(worktree, ["diff", "--stat", "--", ...pathspec]),
    patch: gitOutput(worktree, ["diff", "--", ...pathspec]).slice(0, 60000)
  };
}

function readRunLog(logsPath: string | null | undefined, name: string): string {
  if (!logsPath) {
    return "";
  }
  const path = join(logsPath, name);
  if (!existsSync(path)) {
    return "";
  }
  return readFileSync(path, "utf8").slice(0, 20000);
}

export function getDashboardData(): DashboardData {
  const config = loadConfig(process.cwd());
  const db = new DatabaseSync(config.app.paths.database);
  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      github_owner TEXT NOT NULL,
      github_repo TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      local_path TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      created_by TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      workflow TEXT NOT NULL DEFAULT 'default',
      current_stage TEXT,
      branch_name TEXT,
      worktree_path TEXT,
      pr_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT,
      approved_by TEXT,
      comment TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS github_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_with_owner TEXT NOT NULL UNIQUE,
      github_owner TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      private INTEGER NOT NULL DEFAULT 0,
      default_branch TEXT NOT NULL DEFAULT 'main',
      url TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );
  `);
  try {
    const tasks = db.prepare(`
      SELECT tasks.id,
             tasks.title,
             tasks.description,
             repos.name AS repo,
             tasks.status,
             tasks.current_stage AS stage,
             tasks.pr_url AS pr
      FROM tasks
      JOIN repos ON repos.id = tasks.repo_id
      ORDER BY tasks.updated_at DESC
      LIMIT 50
    `).all() as Array<{
      id: number;
      title: string;
      description: string;
      repo: string;
      status: string;
      stage: string | null;
      pr: string | null;
    }>;

    const approvals = db.prepare(`
      SELECT task_id AS taskId, stage, status
      FROM approvals
      ORDER BY created_at DESC
      LIMIT 20
    `).all() as Array<{ taskId: number; stage: string; status: string }>;

    const repos = db.prepare(`
      SELECT id, name, github_owner || '/' || github_repo AS github
      FROM repos
      WHERE active = 1
      ORDER BY name
    `).all() as Array<{ id: number; name: string; github: string }>;

    const githubRepos = db.prepare(`
      SELECT id,
             name_with_owner AS nameWithOwner,
             description,
             CASE private WHEN 1 THEN 'private' ELSE 'public' END AS visibility,
             default_branch AS defaultBranch,
             url,
             updated_at AS updatedAt
      FROM github_repos
      ORDER BY updated_at DESC, name_with_owner ASC
    `).all() as DashboardData["githubRepos"];

    const localTools = detectLocalTools(config.agents);
    const marketById = new Map(localTools.map((tool) => [tool.id, tool]));

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        repo: task.repo,
        status: task.status,
        stage: task.stage,
        pr: task.pr,
        runtime: config.agents.agents.find((agent) => agent.enabled)?.id ?? "none"
      })),
      approvals: approvals.map((approval) => ({
        taskId: approval.taskId,
        stage: approval.stage,
        status: approval.status
      })),
      runtimes: config.agents.agents.map((agent) => {
        const market = marketById.get(agent.id);
        return {
          id: agent.id,
          label: agent.label,
          type: agent.type,
          enabled: agent.enabled,
          configuredEnabled: agent.configuredEnabled ?? agent.enabled,
          detected: agent.detected ?? false,
          detectedCommand: agent.detectedCommand ?? null,
          command: agent.command ?? null,
          args: agent.args ?? [],
          models: agent.models ?? [],
          defaultModel: agent.defaultModel ?? null,
          executionMode: agent.executionMode ?? "headless",
          capabilities: agent.capabilities,
          preferredRoles: agent.preferredRoles ?? [],
          promptSelectable: Boolean(agent.enabled || market?.promptRunnable),
          marketSummary: market?.marketSummary ?? null,
          marketRank: market?.marketRank ?? null
        };
      }),
      roles: Object.entries(config.agents.roles).map(([id, route]) => ({
        id,
        preferred: route.preferred,
        fallback: route.fallback
      })),
      localTools,
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        github: repo.github
      })),
      githubRepos: githubRepos.map((repo) => ({
        id: repo.id,
        nameWithOwner: repo.nameWithOwner,
        description: repo.description,
        visibility: repo.visibility,
        defaultBranch: repo.defaultBranch,
        url: repo.url,
        updatedAt: repo.updatedAt
      }))
    };
  } finally {
    db.close();
  }
}

export function getTaskDetail(taskId: number): TaskDetailData {
  const config = loadConfig(process.cwd());
  const db = new DatabaseSync(config.app.paths.database);
  try {
    const task = db.prepare(`
      SELECT tasks.id,
             tasks.title,
             tasks.description,
             repos.name AS repo,
             tasks.status,
             tasks.current_stage AS stage,
             tasks.branch_name AS branch,
             tasks.worktree_path AS worktree,
             tasks.pr_url AS pr
      FROM tasks
      JOIN repos ON repos.id = tasks.repo_id
      WHERE tasks.id = ?
    `).get(taskId) as TaskDetailData["task"];

    const approvals = db.prepare(`
      SELECT stage, status, approved_by AS approvedBy, comment, created_at AS createdAt
      FROM approvals
      WHERE task_id = ?
      ORDER BY created_at DESC
    `).all(taskId) as TaskDetailData["approvals"];

    const artifacts: Array<{ name: string; content: string }> = [];
    if (task?.worktree) {
      const dir = join(task.worktree, ".ai", "tasks", `TASK-${task.id}`);
      for (const name of ["requirements.md", "design.md", "implementation-plan.md", "implementation.md", "review.md", "decision-log.md"]) {
        const path = join(dir, name);
        if (existsSync(path)) {
          artifacts.push({ name, content: readFileSync(path, "utf8") });
        }
      }
    }

    const runs = db.prepare(`
      SELECT stage,
             role,
             runtime_id AS runtimeId,
             status,
             logs_path AS logsPath,
             started_at AS startedAt,
             finished_at AS finishedAt,
             error
      FROM agent_runs
      WHERE task_id = ?
      ORDER BY started_at DESC
    `).all(taskId) as Array<Omit<TaskDetailData["runs"][number], "prompt" | "stdout" | "stderr">>;

    return {
      task,
      artifacts,
      approvals,
      diff: getWorktreeDiff(task?.worktree),
      runs: runs.map((run) => ({
        ...run,
        prompt: readRunLog(run.logsPath, "prompt.md"),
        stdout: readRunLog(run.logsPath, "stdout.log"),
        stderr: readRunLog(run.logsPath, "stderr.log")
      })),
      runtimes: config.agents.agents.map((agent) => ({
        id: agent.id,
        label: agent.label,
        type: agent.type,
        enabled: agent.enabled,
        configuredEnabled: agent.configuredEnabled ?? agent.enabled,
        detected: agent.detected ?? false,
        detectedCommand: agent.detectedCommand ?? null,
        command: agent.command ?? null,
        args: agent.args ?? [],
        models: agent.models ?? [],
        defaultModel: agent.defaultModel ?? null,
        executionMode: agent.executionMode ?? "headless",
        capabilities: agent.capabilities,
        preferredRoles: agent.preferredRoles ?? [],
        promptSelectable: agent.enabled,
        marketSummary: null,
        marketRank: null
      }))
    };
  } finally {
    db.close();
  }
}

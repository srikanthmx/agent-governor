import { loadConfig } from "@agent-governor/config";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

export interface DashboardData {
  tasks: Array<{ id: number; repo: string; status: string; stage: string | null; runtime: string; pr: string | null }>;
  approvals: Array<{ taskId: number; stage: string; status: string }>;
  runtimes: Array<{ id: string; type: string; enabled: boolean }>;
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
      SELECT tasks.id, repos.name AS repo, tasks.status, tasks.current_stage AS stage, tasks.pr_url AS pr
      FROM tasks
      JOIN repos ON repos.id = tasks.repo_id
      ORDER BY tasks.updated_at DESC
      LIMIT 50
    `).all() as Array<{ id: number; repo: string; status: string; stage: string | null; pr: string | null }>;

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
      LIMIT 100
    `).all() as DashboardData["githubRepos"];

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
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
      runtimes: config.agents.agents.map((agent) => ({ id: agent.id, type: agent.type, enabled: agent.enabled })),
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

    return { task, artifacts, approvals };
  } finally {
    db.close();
  }
}

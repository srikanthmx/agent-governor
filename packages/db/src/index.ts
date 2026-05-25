import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { RepoRecord, TaskRecord, TaskStatus } from "@agent-governor/core";
import { nowIso } from "@agent-governor/core";

export type GovernorDb = Database.Database;

export function openDb(path: string): GovernorDb {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: GovernorDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT UNIQUE,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'contributor',
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS repo_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      telegram_user_id TEXT NOT NULL,
      UNIQUE(repo_id, telegram_user_id)
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

    CREATE TABLE IF NOT EXISTS runtime_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL,
      capabilities_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      role TEXT NOT NULL,
      runtime_id TEXT NOT NULL,
      status TEXT NOT NULL,
      logs_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export class RepoRegistry {
  constructor(private readonly db: GovernorDb) {}

  listRepos(): RepoRecord[] {
    return this.db.prepare("SELECT * FROM repos WHERE active = 1 ORDER BY name").all() as RepoRecord[];
  }

  findByName(name: string): RepoRecord | undefined {
    return this.db.prepare("SELECT * FROM repos WHERE name = ?").get(name) as RepoRecord | undefined;
  }

  addRepo(input: {
    name: string;
    githubOwner: string;
    githubRepo: string;
    defaultBranch: string;
    localPath: string;
    owners?: string[];
  }): RepoRecord {
    const createdAt = nowIso();
    const result = this.db
      .prepare(
        `INSERT INTO repos (name, github_owner, github_repo, default_branch, local_path, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(input.name, input.githubOwner, input.githubRepo, input.defaultBranch, input.localPath, createdAt);
    const repoId = Number(result.lastInsertRowid);
    for (const owner of input.owners ?? []) {
      this.db
        .prepare("INSERT OR IGNORE INTO repo_owners (repo_id, telegram_user_id) VALUES (?, ?)")
        .run(repoId, owner);
    }
    return this.db.prepare("SELECT * FROM repos WHERE id = ?").get(repoId) as RepoRecord;
  }
}

export class TaskStore {
  constructor(private readonly db: GovernorDb) {}

  createIdea(input: { repoId: number; createdBy: string; title: string; description: string; workflow?: string }): TaskRecord {
    const now = nowIso();
    const result = this.db
      .prepare(
        `INSERT INTO tasks (repo_id, created_by, title, description, status, workflow, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'NEW', ?, ?, ?)`
      )
      .run(input.repoId, input.createdBy, input.title, input.description, input.workflow ?? "default", now, now);
    return this.getTask(Number(result.lastInsertRowid));
  }

  getTask(id: number): TaskRecord {
    const task = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRecord | undefined;
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    return task;
  }

  listTasks(): TaskRecord[] {
    return this.db.prepare("SELECT * FROM tasks ORDER BY updated_at DESC").all() as TaskRecord[];
  }

  updateStatus(id: number, status: TaskStatus, currentStage?: string): void {
    this.db
      .prepare("UPDATE tasks SET status = ?, current_stage = COALESCE(?, current_stage), updated_at = ? WHERE id = ?")
      .run(status, currentStage ?? null, nowIso(), id);
  }
}

export class ApprovalEngine {
  constructor(private readonly db: GovernorDb, private readonly globalOwners: string[]) {}

  isOwner(telegramUserId: string, repoId?: number): boolean {
    if (this.globalOwners.includes(telegramUserId)) {
      return true;
    }
    if (!repoId) {
      return false;
    }
    const row = this.db
      .prepare("SELECT id FROM repo_owners WHERE repo_id = ? AND telegram_user_id = ?")
      .get(repoId, telegramUserId);
    return Boolean(row);
  }

  requireOwner(telegramUserId: string, repoId?: number): void {
    if (!this.isOwner(telegramUserId, repoId)) {
      throw new Error("Owner approval required");
    }
  }

  approve(taskId: number, stage: string, ownerId: string, comment?: string): void {
    const task = this.db.prepare("SELECT repo_id FROM tasks WHERE id = ?").get(taskId) as { repo_id: number } | undefined;
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    this.requireOwner(ownerId, task.repo_id);
    this.db
      .prepare(
        `INSERT INTO approvals (task_id, stage, status, approved_by, comment, created_at)
         VALUES (?, ?, 'approved', ?, ?, ?)`
      )
      .run(taskId, stage, ownerId, comment ?? null, nowIso());
  }
}

export function audit(db: GovernorDb, input: {
  actorType: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}): void {
  db.prepare(
    `INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.actorType,
    input.actorId,
    input.action,
    input.entityType,
    input.entityId,
    JSON.stringify(input.metadata ?? {}),
    nowIso()
  );
}

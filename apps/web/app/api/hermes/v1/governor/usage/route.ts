import { loadConfig } from "@agent-governor/config";
import { DatabaseSync } from "node:sqlite";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadConfig(process.cwd());
  const db = new DatabaseSync(config.app.paths.database);
  try {
    ensureTables(db);
    const tasks = db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number };
    const runs = db.prepare("SELECT COUNT(*) AS count FROM agent_runs").get() as { count: number };
    const openApprovals = db.prepare("SELECT COUNT(*) AS count FROM approvals WHERE status = 'pending'").get() as { count: number };
    const byRuntime = db.prepare(`
      SELECT runtime_id AS runtimeId, COUNT(*) AS count
      FROM agent_runs
      GROUP BY runtime_id
      ORDER BY count DESC, runtime_id ASC
    `).all() as Array<{ runtimeId: string; count: number }>;

    return NextResponse.json({
      object: "governor.usage",
      tasks: tasks.count,
      agentRuns: runs.count,
      openApprovals: openApprovals.count,
      byRuntime
    });
  } finally {
    db.close();
  }
}

function ensureTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
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
      task_id INTEGER NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT,
      approved_by TEXT,
      comment TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      stage TEXT NOT NULL,
      role TEXT NOT NULL,
      runtime_id TEXT NOT NULL,
      status TEXT NOT NULL,
      logs_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error TEXT
    );
  `);
}

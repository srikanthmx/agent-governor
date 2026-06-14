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
      SELECT runtime_id AS runtimeId,
             COUNT(*) AS count,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
             SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failures,
             ROUND(AVG(latency_ms), 0) AS avgLatencyMs,
             ROUND(SUM(COALESCE(estimated_cost_usd, 0)), 6) AS estimatedCostUsd
      FROM agent_runs
      GROUP BY runtime_id
      ORDER BY count DESC, runtime_id ASC
    `).all() as Array<{ runtimeId: string; count: number; successes: number; failures: number; avgLatencyMs: number | null; estimatedCostUsd: number }>;
    const byTaskType = db.prepare(`
      SELECT COALESCE(task_type, stage) AS taskType,
             COUNT(*) AS count,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
             SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failures,
             ROUND(AVG(latency_ms), 0) AS avgLatencyMs
      FROM agent_runs
      GROUP BY COALESCE(task_type, stage)
      ORDER BY count DESC, taskType ASC
    `).all() as Array<{ taskType: string; count: number; successes: number; failures: number; avgLatencyMs: number | null }>;
    const totals = db.prepare(`
      SELECT ROUND(AVG(latency_ms), 0) AS avgLatencyMs,
             ROUND(SUM(COALESCE(estimated_cost_usd, 0)), 6) AS estimatedCostUsd,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
             SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failures
      FROM agent_runs
    `).get() as { avgLatencyMs: number | null; estimatedCostUsd: number | null; successes: number | null; failures: number | null };

    return NextResponse.json({
      object: "governor.usage",
      tasks: tasks.count,
      agentRuns: runs.count,
      openApprovals: openApprovals.count,
      successRate: runs.count > 0 ? Number(((totals.successes ?? 0) / runs.count).toFixed(4)) : null,
      avgLatencyMs: totals.avgLatencyMs,
      estimatedCostUsd: totals.estimatedCostUsd ?? 0,
      failures: totals.failures ?? 0,
      successes: totals.successes ?? 0,
      byTaskType,
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
      error TEXT,
      task_type TEXT,
      latency_ms INTEGER,
      estimated_cost_usd REAL,
      fallback_path_json TEXT,
      route_attempts_json TEXT
    );
  `);
  ensureColumn(db, "agent_runs", "task_type", "TEXT");
  ensureColumn(db, "agent_runs", "latency_ms", "INTEGER");
  ensureColumn(db, "agent_runs", "estimated_cost_usd", "REAL");
  ensureColumn(db, "agent_runs", "fallback_path_json", "TEXT");
  ensureColumn(db, "agent_runs", "route_attempts_json", "TEXT");
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

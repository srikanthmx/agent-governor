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
    const events = db.prepare(`
      SELECT 'task' AS type,
             id AS subjectId,
             status,
             created_by AS actor,
             created_at AS createdAt,
             updated_at AS updatedAt,
             title AS summary
      FROM tasks
      UNION ALL
      SELECT 'approval' AS type,
             task_id AS subjectId,
             status,
             COALESCE(approved_by, requested_by, 'system') AS actor,
             created_at AS createdAt,
             created_at AS updatedAt,
             stage AS summary
      FROM approvals
      UNION ALL
      SELECT action AS type,
             entity_id AS subjectId,
             json_extract(metadata_json, '$.status') AS status,
             actor_id AS actor,
             created_at AS createdAt,
             created_at AS updatedAt,
             COALESCE(
               json_extract(metadata_json, '$.runtimeId'),
               json_extract(metadata_json, '$.stage'),
               action
             ) AS summary
      FROM audit_logs
      WHERE action LIKE 'runtime.%'
      ORDER BY updatedAt DESC
      LIMIT 50
    `).all();

    return NextResponse.json({
      object: "list",
      data: events
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

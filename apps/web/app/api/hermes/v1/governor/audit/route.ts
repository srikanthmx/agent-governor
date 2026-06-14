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
  `);
}

import { loadConfig } from "@agent-governor/config";
import { migrate, openDb } from "@agent-governor/db";
import { WorkflowEngine } from "@agent-governor/workflow";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { owner?: string; limit?: number };
  const config = loadConfig(process.cwd());
  const db = openDb(config.app.paths.database);
  migrate(db);
  try {
    const repos = await new WorkflowEngine({ db, config }).syncGithubRepos({
      owner: body.owner,
      limit: body.limit ?? 100
    });
    return NextResponse.json({ ok: true, count: repos.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}

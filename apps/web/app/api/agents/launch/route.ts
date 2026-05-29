import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadConfig } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    repo?: string;
    runtimeId?: string;
    prompt?: string;
  };
  if (!body.repo || !body.runtimeId || !body.prompt) {
    return NextResponse.json({ ok: false, error: "repo, runtimeId, and prompt are required" }, { status: 400 });
  }

  const config = loadConfig(process.cwd());
  const agent = config.agents.agents.find((candidate) => candidate.id === body.runtimeId);
  if (!agent?.enabled || agent.executionMode !== "interactive" || !agent.command) {
    return NextResponse.json({ ok: false, error: `${body.runtimeId} is not an enabled interactive agent` }, { status: 400 });
  }

  const db = new DatabaseSync(config.app.paths.database);
  try {
    const repo = db.prepare("SELECT name, local_path FROM repos WHERE name = ? AND active = 1").get(body.repo) as
      | { name: string; local_path: string }
      | undefined;
    if (!repo) {
      return NextResponse.json({ ok: false, error: `Repo not found: ${body.repo}` }, { status: 404 });
    }

    const runDir = join(config.app.paths.logs, "interactive", agent.id, String(Date.now()));
    mkdirSync(runDir, { recursive: true });
    const promptPath = join(runDir, "prompt.md");
    writeFileSync(promptPath, body.prompt);

    const args = (agent.args ?? [])
      .map((arg) => arg
        .replaceAll("{promptFile}", promptPath)
        .replaceAll("{model}", agent.defaultModel ?? ""));
    const result = await execa(agent.command, args, {
      cwd: repo.local_path,
      env: {
        ...process.env,
        AGENT_GOVERNOR_PROMPT_FILE: promptPath,
        AGENT_GOVERNOR_MODEL: agent.defaultModel ?? ""
      },
      reject: false,
      timeout: 15_000
    });
    const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
    writeFileSync(join(runDir, "launch.log"), output || `Exited with ${result.exitCode}`);

    return NextResponse.json({
      ok: result.exitCode === 0,
      runtimeId: agent.id,
      repo: repo.name,
      cwd: repo.local_path,
      logsPath: runDir,
      output,
      error: result.exitCode === 0 ? undefined : output || `${agent.id} exited with ${result.exitCode}`
    }, { status: result.exitCode === 0 ? 200 : 500 });
  } finally {
    db.close();
  }
}

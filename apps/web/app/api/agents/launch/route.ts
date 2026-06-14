import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadConfig, type AgentConfig } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Agent = AgentConfig["agents"][number];

function interactiveLaunch(agent: Agent, repoPath: string, promptPath: string): { command: string; args: string[] } {
  if (agent.detectedCommand?.endsWith(".app")) {
    return { command: "open", args: ["-a", agent.detectedCommand, repoPath, promptPath] };
  }

  const command = agent.detectedCommand && existsSync(agent.detectedCommand)
    ? agent.detectedCommand
    : agent.command;
  if (!command) {
    throw new Error(`${agent.id} does not have a launch command`);
  }

  return {
    command,
    args: (agent.args ?? [])
      .map((arg) => arg
        .replaceAll("{promptFile}", promptPath)
        .replaceAll("{repoPath}", repoPath)
        .replaceAll("{model}", agent.defaultModel ?? ""))
  };
}

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
  if (!agent?.enabled || agent.executionMode !== "interactive") {
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

    const launch = interactiveLaunch(agent, repo.local_path, promptPath);
    const result = await execa(launch.command, launch.args, {
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

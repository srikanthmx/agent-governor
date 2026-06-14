import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig } from "@agent-governor/config";
import { ShellAdapter } from "@agent-governor/runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    runtimeId?: string;
    model?: string;
  };
  if (!body.runtimeId) {
    return NextResponse.json({ ok: false, error: "runtimeId is required" }, { status: 400 });
  }

  const config = loadConfig(process.cwd());
  const agent = config.agents.agents.find((candidate) => candidate.id === body.runtimeId);
  if (!agent?.enabled) {
    return NextResponse.json({ ok: false, error: `${body.runtimeId} is not an enabled runtime` }, { status: 400 });
  }
  if (agent.executionMode === "interactive") {
    return NextResponse.json({ ok: false, error: `${agent.label} is interactive and cannot run a command-line dry run` }, { status: 400 });
  }
  if (!agent.command) {
    return NextResponse.json({ ok: false, error: `${body.runtimeId} does not have a CLI command` }, { status: 400 });
  }

  const sampleRepo = mkdtempSync(join(tmpdir(), "agent-governor-sample-"));
  writeFileSync(join(sampleRepo, "README.md"), "# Agent Governor Sample Repo\n\nA tiny repo used for agent dry runs.\n");
  writeFileSync(join(sampleRepo, "package.json"), JSON.stringify({ name: "agent-governor-sample", private: true }, null, 2));
  execFileSync("git", ["init"], { cwd: sampleRepo, stdio: "ignore" });

  const adapter = new ShellAdapter({
    id: agent.id,
    label: agent.label,
    type: agent.type,
    command: agent.command,
    args: agent.args,
    capabilities: agent.capabilities,
    logsRoot: config.app.paths.logs
  });

  const result = await adapter.run({
    taskId: "dry-run",
    repoId: "sample",
    repoPath: sampleRepo,
    stage: "sample",
    role: "dry_run",
    worktreePath: sampleRepo,
    prompt: [
      "This is an Agent Governor sample dry run.",
      "Inspect this tiny repository and respond with a short summary.",
      "Do not edit files, install packages, create commits, or access secrets."
    ].join("\n"),
    contextFiles: ["README.md", "package.json"],
    expectedOutput: "markdown",
    model: body.model || agent.defaultModel
  });

  return NextResponse.json(
    {
      ok: result.status === "success",
      runtimeId: agent.id,
      sampleRepo,
      logsPath: result.logsPath,
      summary: result.summary,
      error: result.error
    },
    { status: result.status === "success" ? 200 : 500 }
  );
}

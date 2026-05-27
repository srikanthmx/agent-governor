import { loadConfig, projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";
import { resolveWebOwner } from "../owner";

export const runtime = "nodejs";

async function runAgent(args: string[]) {
  const result = await execa("pnpm", ["agent", ...args], {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  return {
    ok: result.exitCode === 0,
    command: `pnpm agent ${args.join(" ")}`,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n")
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    taskId?: string;
    owner?: string;
    runtimeId?: string;
    model?: string;
  };
  const taskId = String(body.taskId ?? "").replace(/^TASK-/i, "");
  if (!taskId || Number.isNaN(Number(taskId))) {
    return NextResponse.json({ ok: false, error: "taskId is required" }, { status: 400 });
  }

  const config = loadConfig(process.cwd());
  let owner: string;
  try {
    owner = resolveWebOwner(config, body.owner);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const runArgs = ["run-task", taskId];
  if (body.runtimeId) {
    runArgs.push("--runtime", body.runtimeId);
  }
  if (body.model) {
    runArgs.push("--model", body.model);
  }

  const actions = [
    await runAgent(runArgs),
    await runAgent(["approve", taskId, "--stage", "requirements", "--owner", owner]),
    await runAgent(runArgs),
    await runAgent(["approve", taskId, "--stage", "design", "--owner", owner]),
    await runAgent(runArgs)
  ];

  const finalRun = actions[actions.length - 1];
  return NextResponse.json(
    {
      ok: finalRun.ok,
      actions,
      error: finalRun.ok ? undefined : finalRun.output || `${finalRun.command} failed`
    },
    { status: finalRun.ok ? 200 : 500 }
  );
}

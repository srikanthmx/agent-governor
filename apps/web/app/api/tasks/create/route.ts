import { projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    repo?: string;
    title?: string;
    description?: string;
    runtimeId?: string;
    model?: string;
    run?: boolean;
  };
  if (!body.repo || !body.title || !body.description) {
    return NextResponse.json({ ok: false, error: "repo, title, and description are required" }, { status: 400 });
  }
  const result = await execa("pnpm", [
    "agent",
    "create-task",
    "--repo",
    body.repo,
    "--title",
    body.title,
    "--description",
    body.description,
    "--actor",
    "web"
  ], {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
  const taskId = output.match(/Created\s+(TASK-\d+)/i)?.[1];
  let runOutput = "";
  let runOk = true;
  if (body.run && taskId) {
    const runArgs = ["agent", "run-task", taskId.replace(/^TASK-/i, "")];
    if (body.runtimeId) {
      runArgs.push("--runtime", body.runtimeId);
    }
    if (body.model) {
      runArgs.push("--model", body.model);
    }
    const runResult = await execa("pnpm", runArgs, {
      cwd: projectRoot(process.cwd()),
      reject: false
    });
    runOutput = [runResult.stdout, runResult.stderr].filter((value): value is string => Boolean(value)).join("\n");
    runOk = runResult.exitCode === 0;
  }

  return NextResponse.json(
    {
      ok: result.exitCode === 0 && runOk,
      taskId,
      output,
      runOutput,
      error: result.exitCode === 0 && runOk ? undefined : runOutput || output || `create task exited with ${result.exitCode}`
    },
    { status: result.exitCode === 0 && runOk ? 200 : 500 }
  );
}

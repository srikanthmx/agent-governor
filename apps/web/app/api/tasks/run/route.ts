import { projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    taskId?: string;
    runtimeId?: string;
    model?: string;
  };
  const taskId = String(body.taskId ?? "").replace(/^TASK-/i, "");
  if (!taskId || Number.isNaN(Number(taskId))) {
    return NextResponse.json({ ok: false, error: "taskId is required" }, { status: 400 });
  }

  const args = ["agent", "run-task", taskId];
  if (body.runtimeId) {
    args.push("--runtime", body.runtimeId);
  }
  if (body.model) {
    args.push("--model", body.model);
  }

  const result = await execa("pnpm", args, {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
  return NextResponse.json(
    {
      ok: result.exitCode === 0,
      output,
      error: result.exitCode === 0 ? undefined : output || `run-task exited with ${result.exitCode}`
    },
    { status: result.exitCode === 0 ? 200 : 500 }
  );
}

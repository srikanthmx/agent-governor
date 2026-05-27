import { loadConfig, projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";
import { resolveWebOwner } from "../owner";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    taskId?: string;
    stage?: string;
    owner?: string;
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

  const args = ["agent", "approve", taskId];
  if (body.stage) args.push("--stage", body.stage);
  args.push("--owner", owner);

  const result = await execa("pnpm", args, {
    cwd: projectRoot(process.cwd()),
    reject: false,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return NextResponse.json(
    { ok: result.exitCode === 0, output, error: result.exitCode === 0 ? undefined : output || `approve exited with ${result.exitCode}` },
    { status: result.exitCode === 0 ? 200 : 500 }
  );
}

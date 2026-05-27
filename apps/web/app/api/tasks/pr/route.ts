import { loadConfig, projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";
import { resolveWebOwner } from "../owner";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    taskId?: string;
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

  const approve = await execa("pnpm", ["agent", "approve", taskId, "--stage", "pr", "--owner", owner], {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const approveOutput = [approve.stdout, approve.stderr].filter(Boolean).join("\n");
  if (approve.exitCode !== 0) {
    return NextResponse.json({ ok: false, output: approveOutput, error: approveOutput || "PR approval failed" }, { status: 500 });
  }

  const open = await execa("pnpm", ["agent", "open-pr", taskId, "--owner", owner], {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const openOutput = [open.stdout, open.stderr].filter(Boolean).join("\n");
  return NextResponse.json(
    {
      ok: open.exitCode === 0,
      output: [approveOutput, openOutput].filter(Boolean).join("\n"),
      prUrl: open.exitCode === 0 ? open.stdout.trim().split(/\n/).at(-1) : undefined,
      error: open.exitCode === 0 ? undefined : openOutput || "Open PR failed"
    },
    { status: open.exitCode === 0 ? 200 : 500 }
  );
}

import { projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    name?: string;
    owner?: string;
    repo?: string;
    path?: string;
    branch?: string;
  };
  if (!body.name || !body.owner || !body.repo || !body.path) {
    return NextResponse.json({ ok: false, error: "name, owner, repo, and path are required" }, { status: 400 });
  }
  const result = await execa("pnpm", [
    "agent",
    "add-repo",
    "--name",
    body.name,
    "--owner",
    body.owner,
    "--repo",
    body.repo,
    "--path",
    body.path,
    "--branch",
    body.branch || "main"
  ], {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
  return NextResponse.json(
    {
      ok: result.exitCode === 0,
      output,
      error: result.exitCode === 0 ? undefined : output || `register exited with ${result.exitCode}`
    },
    { status: result.exitCode === 0 ? 200 : 500 }
  );
}

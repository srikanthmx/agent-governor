import { projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    nameWithOwner?: string;
    defaultBranch?: string;
  };
  if (!body.nameWithOwner || !body.nameWithOwner.includes("/")) {
    return NextResponse.json({ ok: false, error: "nameWithOwner is required" }, { status: 400 });
  }
  const [owner, repo] = body.nameWithOwner.split("/");
  const args = [
    "agent",
    "clone-repo",
    "--name",
    repo,
    "--owner",
    owner,
    "--repo",
    repo,
    "--branch",
    body.defaultBranch || "main"
  ];
  const result = await execa("pnpm", args, {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
  return NextResponse.json(
    {
      ok: result.exitCode === 0,
      output,
      error: result.exitCode === 0 ? undefined : output || `clone exited with ${result.exitCode}`
    },
    { status: result.exitCode === 0 ? 200 : 500 }
  );
}

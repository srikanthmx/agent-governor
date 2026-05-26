import { projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { owner?: string; limit?: number };
  const args = ["agent", "sync-github-repos", "--limit", String(body.limit ?? 100)];
  if (body.owner) {
    args.push("--owner", body.owner);
  }

  const result = await execa("pnpm", args, {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
  const count = output.match(/Synced\s+(\d+)\s+GitHub repos/i)?.[1];

  return NextResponse.json(
    {
      ok: result.exitCode === 0,
      count: count ? Number(count) : 0,
      output,
      error: result.exitCode === 0 ? undefined : output || `sync exited with ${result.exitCode}`
    },
    { status: result.exitCode === 0 ? 200 : 500 }
  );
}

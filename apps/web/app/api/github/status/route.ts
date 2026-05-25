import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const result = await execa("gh", ["auth", "status"], { reject: false });
  return NextResponse.json({
    authenticated: result.exitCode === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n")
  });
}

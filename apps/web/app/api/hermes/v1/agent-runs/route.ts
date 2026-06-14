import { NextResponse } from "next/server";
import { createHermesRun } from "../../_bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AgentRunRequest = {
  model?: string;
  prompt?: string;
  repo?: string;
  preferred_agent?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as AgentRunRequest;
  const run = createHermesRun(body);

  return NextResponse.json({
    ok: true,
    run,
    message: "Hermes request accepted. Agent Governor will route only to opted-in P2P shared desktop agents."
  });
}

export async function GET() {
  const run = createHermesRun({
    prompt: "List current Hermes bridge sample run.",
    repo: "abandoned-circle",
    preferred_agent: "gemini"
  });

  return NextResponse.json({
    ok: true,
    runs: [run]
  });
}

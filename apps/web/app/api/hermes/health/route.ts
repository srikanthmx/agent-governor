import { NextResponse } from "next/server";
import { getHermesSidecarStatus } from "../_sidecar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    bridge: "hermes",
    mode: "openai-compatible-local-model-adapter",
    cloudExecution: false,
    routes: {
      chatCompletions: "/api/hermes/v1/chat/completions",
      agentRuns: "/api/hermes/v1/agent-runs",
      events: "/api/hermes/v1/agent-runs/:runId/events"
    },
    sidecar: await getHermesSidecarStatus(),
    sidecarRoutes: {
      status: "/api/hermes/sidecar",
      proxy: "/api/hermes/proxy/:path*"
    },
    policy: {
      chatCompletions: "respond as a model; no Governor Git task or PR side effects",
      routableAgents: "p2p_shared only",
      privateAgents: "owner only",
      executionOwner: "desktop peer"
    }
  });
}

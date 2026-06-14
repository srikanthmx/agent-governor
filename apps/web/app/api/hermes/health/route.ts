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
      models: "/api/hermes/v1/models",
      chatCompletions: "/api/hermes/v1/chat/completions",
      runtimes: "/api/hermes/v1/governor/runtimes",
      policy: "/api/hermes/v1/governor/policy",
      usage: "/api/hermes/v1/governor/usage",
      audit: "/api/hermes/v1/governor/audit",
      agentRuns: "/api/hermes/v1/agent-runs",
      events: "/api/hermes/v1/agent-runs/:runId/events"
    },
    sidecar: await getHermesSidecarStatus(),
    sidecarRoutes: {
      status: "/api/hermes/sidecar",
      proxy: "/api/hermes/proxy/:path*"
    },
    policy: {
      brainMode: "respond as an OpenAI-compatible model; normalize valid tool-call JSON into tool_calls[]",
      workerMode: "delegate coding work through explicit Governor task/runtime routes",
      chatCompletions: "no Governor Git task or PR side effects",
      routableAgents: "p2p_shared only",
      privateAgents: "owner only",
      executionOwner: "desktop peer"
    }
  });
}

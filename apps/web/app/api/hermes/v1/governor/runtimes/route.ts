import { detectLocalTools, loadConfig } from "@agent-governor/config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadConfig(process.cwd());
  const detected = new Map(detectLocalTools(config.agents).map((tool) => [tool.id, tool]));

  return NextResponse.json({
    object: "list",
    mode: {
      brain: "Use /api/hermes/v1/chat/completions with a governor-* model alias.",
      worker: "Delegate coding work through Governor task/runtime routes; CLI workers are not exposed as Hermes brain models."
    },
    data: config.agents.agents.map((agent) => {
      const market = detected.get(agent.id);
      return {
        id: agent.id,
        object: "governor.runtime",
        label: agent.label,
        type: agent.type,
        enabled: agent.enabled,
        configuredEnabled: agent.configuredEnabled ?? agent.enabled,
        detected: agent.detected ?? market?.detected ?? false,
        detectedCommand: agent.detectedCommand ?? market?.detectedBy ?? null,
        command: agent.command ?? null,
        executionMode: agent.executionMode ?? "headless",
        capabilities: agent.capabilities,
        preferredRoles: agent.preferredRoles ?? [],
        models: agent.models ?? [],
        defaultModel: agent.defaultModel ?? null,
        workerOnly: true
      };
    })
  });
}

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
        health: runtimeHealth({
          enabled: agent.enabled,
          detected: agent.detected ?? market?.detected ?? false,
          promptRunnable: market?.promptRunnable ?? agent.enabled,
          status: market?.status
        }),
        quota: runtimeQuota(agent.id),
        cost: runtimeCost(agent.id),
        preferredRoles: agent.preferredRoles ?? [],
        models: agent.models ?? [],
        defaultModel: agent.defaultModel ?? null,
        workerOnly: true
      };
    })
  });
}

function runtimeHealth(input: { enabled: boolean; detected: boolean; promptRunnable: boolean; status?: string }) {
  if (input.enabled && input.promptRunnable) return "ready";
  if (input.detected) return input.status === "bridge_required" ? "bridge_required" : "detected";
  return "missing";
}

function runtimeQuota(runtimeId: string) {
  if (runtimeId === "ollama" || runtimeId === "shell") return "local";
  return "unknown";
}

function runtimeCost(runtimeId: string) {
  if (runtimeId === "ollama" || runtimeId === "shell") return "local";
  if (["codex", "claude", "gemini", "copilot"].includes(runtimeId)) return "subscription";
  return "unknown";
}

import { detectLocalTools, loadConfig } from "@agent-governor/config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const config = loadConfig(process.cwd());
  const tools = detectLocalTools(config.agents);
  const runnable = tools.filter((tool) => tool.promptRunnable);
  const gemini = tools.find((tool) => tool.id === "gemini");

  return NextResponse.json({
    ok: true,
    runnableCount: runnable.length,
    detectedCount: tools.filter((tool) => tool.detected).length,
    gemini: gemini
      ? {
          detected: gemini.detected,
          detectedBy: gemini.detectedBy,
          promptRunnable: gemini.promptRunnable,
          reason: gemini.reason,
          installCommand: gemini.installCommand,
          installUrl: gemini.installUrl
        }
      : null
  });
}

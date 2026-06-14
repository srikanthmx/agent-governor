import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getHermesSidecarStatus } from "../../hermes/_sidecar";
import { telegramConfigured, telegramWebhookUrl } from "../../telegram/_telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cwd = process.cwd();
const projectRoot = existsSync(join(cwd, "vendor", "hermes-agent")) ? cwd : join(cwd, "..", "..");
const hermesHome = join(projectRoot, "data", "hermes-home");
const hermesConfigPath = join(hermesHome, "config.yaml");
const desktopBackendUrl = process.env.HERMES_DESKTOP_BACKEND_URL ?? "http://127.0.0.1:9120";

export async function GET() {
  const [sidecar, desktop, bot] = await Promise.all([
    getHermesSidecarStatus(),
    readHermesDesktopStatus(),
    readTelegramBot()
  ]);

  const config = readHermesConfig();

  return NextResponse.json({
    ok: true,
    telegram: {
      configured: telegramConfigured(),
      bot,
      pollerRunning: telegramPollerRunning(),
      webhookEndpoint: "/api/telegram/webhook",
      publicWebhookUrl: telegramWebhookUrl(),
      route: "Telegram -> Hermes API sidecar -> Governor model adapter",
      fallbackRoute: "Telegram -> Governor model adapter",
      secretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
    },
    hermes: {
      desktop,
      apiSidecar: sidecar,
      configPath: hermesConfigPath,
      configuredModel: config.model,
      modelTarget: config.baseUrl,
      modelAdapter: {
        endpoint: "/api/hermes/v1/chat/completions",
        backend: process.env.AG_HERMES_MODEL_BACKEND ?? "codex",
        codexModel: process.env.AG_HERMES_CODEX_MODEL ?? "gpt-5.5"
      }
    }
  });
}

async function readHermesDesktopStatus() {
  try {
    const response = await fetch(`${desktopBackendUrl}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json().catch(() => null);
    return {
      running: response.ok,
      url: desktopBackendUrl,
      status: response.status,
      version: stringValue(data?.version),
      hermesHome: stringValue(data?.hermes_home),
      configPath: stringValue(data?.config_path),
      authRequired: Boolean(data?.auth_required)
    };
  } catch {
    return {
      running: false,
      url: desktopBackendUrl,
      status: null,
      version: null,
      hermesHome: null,
      configPath: null,
      authRequired: false
    };
  }
}

async function readTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { reachable: false, username: null, id: null };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000)
    });
    const data = await response.json().catch(() => null);
    const result = data?.result;
    return {
      reachable: response.ok && Boolean(data?.ok),
      username: stringValue(result?.username),
      id: typeof result?.id === "number" ? result.id : null
    };
  } catch {
    return { reachable: false, username: null, id: null };
  }
}

function telegramPollerRunning() {
  try {
    const output = execFileSync("pgrep", ["-af", "telegram-hermes-poller.mjs"], { encoding: "utf8" });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function readHermesConfig() {
  if (!existsSync(hermesConfigPath)) {
    return { model: null, baseUrl: null };
  }
  const content = readFileSync(hermesConfigPath, "utf8");
  return {
    model: matchConfigValue(content, "default"),
    baseUrl: matchConfigValue(content, "base_url")
  };
}

function matchConfigValue(content: string, key: string) {
  const match = content.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
  return match?.[1] ?? null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

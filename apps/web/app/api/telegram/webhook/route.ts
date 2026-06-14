import { NextResponse } from "next/server";
import { createModelCompletion } from "../../hermes/_model";
import { hermesApiKey, hermesBaseUrl } from "../../hermes/_sidecar";
import {
  sendTelegramMessage,
  telegramConfigured,
  telegramWebhookUrl,
  validateTelegramSecret,
  type TelegramUpdate
} from "../_telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "/api/telegram/webhook",
    configured: telegramConfigured(),
    publicUrl: telegramWebhookUrl(),
    model: "agent-governor-local",
    route: "telegram -> hermes-api-sidecar -> governor-model-adapter",
    hermesEndpoint: `${hermesBaseUrl()}/v1/chat/completions`,
    fallbackModelEndpoint: "/api/hermes/v1/chat/completions",
    note: telegramConfigured()
      ? "Telegram token is configured. POST updates route through Hermes when the API sidecar is reachable."
      : "Telegram token is not configured. POST updates will return simulated delivery payloads."
  });
}

export async function POST(request: Request) {
  if (!validateTelegramSecret(request)) {
    return NextResponse.json({ ok: false, error: "Invalid Telegram webhook secret." }, { status: 401 });
  }

  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  const message = update?.message;
  const chatId = message?.chat?.id == null ? "" : String(message.chat.id);
  const text = message?.text?.trim() ?? "";

  if (!chatId || !text) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "Only text messages with a chat id are routed to Hermes."
    });
  }

  if (/^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(text)) {
    const delivery = await sendTelegramMessage({
      chatId,
      text: [
        "Agent Governor is hooked to Hermes.",
        "Send any prompt here and Governor will answer as the local model adapter for Hermes.",
        "This path does not start a Git task or PR flow."
      ].join("\n")
    });
    return NextResponse.json({ ok: delivery.ok, command: "help", delivery });
  }

  const completion = await createCompletionViaHermes({
    model: "agent-governor-local",
    messages: [
      { role: "user", content: text }
    ],
    metadata: {
      source: "telegram",
      chatId,
      telegramUpdateId: update?.update_id
    }
  });
  const postBackText = completion.choices[0]?.message.content ?? "Received.";
  const delivery = await sendTelegramMessage({ chatId, text: postBackText });

  return NextResponse.json({
    ok: delivery.ok,
    model: completion.model,
    completion,
    delivery
  });
}

async function createCompletionViaHermes(body: Parameters<typeof createModelCompletion>[0]) {
  try {
    const response = await fetch(`${hermesBaseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hermesApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.AG_TELEGRAM_HERMES_TIMEOUT_MS ?? 180_000))
    });
    if (!response.ok) {
      throw new Error(`Hermes API returned ${response.status}`);
    }
    return await response.json() as Awaited<ReturnType<typeof createModelCompletion>>;
  } catch {
    return createModelCompletion(body);
  }
}

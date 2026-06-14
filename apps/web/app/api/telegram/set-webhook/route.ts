import { NextResponse } from "next/server";
import { setTelegramWebhook, telegramConfigured, telegramWebhookUrl } from "../_telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SetWebhookRequest = {
  url?: string;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: telegramConfigured(),
    publicUrl: telegramWebhookUrl(),
    webhook: "/api/telegram/webhook",
    note: "POST here to call Telegram setWebhook when TELEGRAM_BOT_TOKEN and AG_PUBLIC_WEB_URL are configured."
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as SetWebhookRequest;
  return NextResponse.json(await setTelegramWebhook({ url: body.url }));
}

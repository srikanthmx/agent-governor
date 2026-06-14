export type TelegramDelivery =
  | { ok: true; mode: "sent"; result: unknown }
  | { ok: true; mode: "simulated"; result: { chat_id: string; text: string } }
  | { ok: false; mode: "failed"; error: string; status?: number; result?: unknown };

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: {
      id?: number | string;
      type?: string;
    };
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
    };
  };
};

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function telegramWebhookUrl() {
  const baseUrl = process.env.AG_PUBLIC_WEB_URL;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;
}

export function validateTelegramSecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

export async function sendTelegramMessage(input: { chatId: string; text: string }): Promise<TelegramDelivery> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      ok: true,
      mode: "simulated",
      result: {
        chat_id: input.chatId,
        text: input.text
      }
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: false
    })
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      mode: "failed",
      status: response.status,
      error: telegramError(result) ?? `Telegram sendMessage failed with ${response.status}`,
      result
    };
  }

  return { ok: true, mode: "sent", result };
}

export async function setTelegramWebhook(input?: { url?: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = input?.url ?? telegramWebhookUrl();

  if (!token) {
    return { ok: false, mode: "missing_token", error: "TELEGRAM_BOT_TOKEN is not configured." };
  }
  if (!url) {
    return { ok: false, mode: "missing_public_url", error: "AG_PUBLIC_WEB_URL is required to set the Telegram webhook." };
  }

  const body: Record<string, string> = { url };
  if (process.env.TELEGRAM_WEBHOOK_SECRET) {
    body.secret_token = process.env.TELEGRAM_WEBHOOK_SECRET;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => null);

  return {
    ok: response.ok && Boolean((result as { ok?: boolean } | null)?.ok),
    mode: "set_webhook",
    url,
    result,
    error: response.ok ? telegramError(result) : `Telegram setWebhook failed with ${response.status}`
  };
}

function telegramError(result: unknown) {
  if (result && typeof result === "object" && "description" in result) {
    const description = (result as { description?: unknown }).description;
    return typeof description === "string" ? description : undefined;
  }
  return undefined;
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.AG_TELEGRAM_LOCAL_WEBHOOK ?? "http://127.0.0.1:3004/api/telegram/webhook";
const pollIntervalMs = Number(process.env.AG_TELEGRAM_POLL_INTERVAL_MS ?? 1500);

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required.");
  process.exit(1);
}

let offset = Number(process.env.AG_TELEGRAM_UPDATE_OFFSET ?? 0);

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(`${method} failed: ${data?.description ?? response.statusText}`);
  }
  return data.result;
}

async function forward(update) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Governor webhook failed ${response.status}: ${text}`);
  }
  return response.json();
}

async function pollOnce() {
  const updates = await telegram("getUpdates", {
    offset,
    timeout: 20,
    allowed_updates: ["message"]
  });

  for (const update of updates) {
    offset = Math.max(offset, update.update_id + 1);
    const text = update.message?.text;
    const chatId = update.message?.chat?.id;
    if (!text || !chatId) continue;

    try {
      const result = await forward(update);
      console.log(JSON.stringify({
        at: new Date().toISOString(),
        update_id: update.update_id,
        chat_id: chatId,
        ok: result.ok,
        model: result.model,
        delivery: result.delivery?.mode
      }));
    } catch (error) {
      console.error(JSON.stringify({
        at: new Date().toISOString(),
        update_id: update.update_id,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}

console.log(JSON.stringify({
  at: new Date().toISOString(),
  status: "started",
  webhookUrl
}));

for (;;) {
  try {
    await pollOnce();
  } catch (error) {
    console.error(JSON.stringify({
      at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }));
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

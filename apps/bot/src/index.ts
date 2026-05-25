import { loadConfig } from "@agent-governor/config";
import { migrate, openDb } from "@agent-governor/db";
import { createTelegramBot } from "@agent-governor/telegram";

const config = loadConfig(process.cwd());
const token = config.app.telegram.botToken;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN or config/app.yml telegram.botToken is required");
}

const db = openDb(config.app.paths.database);
migrate(db);

const bot = createTelegramBot({ token, db, config });
await bot.launch();
console.log("Agent Governor Telegram bot started");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

import { loadConfig } from "@agent-governor/config";
import { migrate, openDb } from "@agent-governor/db";

const config = loadConfig(process.cwd());
const db = openDb(config.app.paths.database);
migrate(db);

console.log("Agent Governor worker started");
console.log(`Database: ${config.app.paths.database}`);
console.log("Workflow polling is not implemented yet. Use CLI and Telegram skeleton commands for the first slice.");

db.close();

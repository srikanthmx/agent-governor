#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import { Command } from "commander";
import { loadConfig } from "@agent-governor/config";
import { ApprovalEngine, migrate, openDb, RepoRegistry, TaskStore } from "@agent-governor/db";
import { ShellAdapter } from "@agent-governor/runtime";

const program = new Command();

function dbForCwd() {
  const config = loadConfig(process.cwd());
  const db = openDb(config.app.paths.database);
  migrate(db);
  return { config, db };
}

async function commandAvailable(command: string): Promise<boolean> {
  const result = await execa(command, ["--version"], { reject: false });
  return result.exitCode === 0;
}

program.name("agent").description("Agent Governor local control plane").version("0.1.0");

program.command("setup").description("Create local directories and initialize SQLite schema").action(() => {
  const config = loadConfig(process.cwd());
  mkdirSync(config.app.paths.repoRoot, { recursive: true });
  mkdirSync(config.app.paths.logs, { recursive: true });
  const db = openDb(config.app.paths.database);
  migrate(db);
  db.close();
  console.log(`Initialized ${config.app.app.name}`);
  console.log(`Database: ${config.app.paths.database}`);
  console.log(`Repos: ${config.app.paths.repoRoot}`);
});

program.command("doctor").description("Check required local tools and configuration").action(async () => {
  const config = loadConfig(process.cwd());
  const checks = [
    ["node", true],
    ["pnpm", await commandAvailable("pnpm")],
    ["git", await commandAvailable("git")],
    ["gh", await commandAvailable("gh")]
  ] as const;

  for (const [name, ok] of checks) {
    console.log(`${ok ? "ok" : "missing"} ${name}`);
  }
  console.log(`${config.app.telegram.botToken ? "ok" : "missing"} telegram token`);
  console.log(`${config.app.github.owner ? "ok" : "missing"} github owner`);
  console.log(`database ${config.app.paths.database}`);
});

program.command("list-repos").description("List registered repositories").action(() => {
  const { db } = dbForCwd();
  const repos = new RepoRegistry(db).listRepos();
  console.table(repos.map((repo) => ({ id: repo.id, name: repo.name, github: `${repo.github_owner}/${repo.github_repo}` })));
  db.close();
});

program
  .command("add-repo")
  .description("Register an existing repository")
  .requiredOption("--name <name>")
  .requiredOption("--owner <owner>")
  .requiredOption("--repo <repo>")
  .requiredOption("--path <path>")
  .option("--branch <branch>", "Default branch", "main")
  .option("--owners <ids>", "Comma-separated Telegram owner IDs")
  .action((options) => {
    const { db } = dbForCwd();
    const repo = new RepoRegistry(db).addRepo({
      name: options.name,
      githubOwner: options.owner,
      githubRepo: options.repo,
      defaultBranch: options.branch,
      localPath: resolve(process.cwd(), options.path),
      owners: (options.owners ?? "").split(",").map((id: string) => id.trim()).filter(Boolean)
    });
    console.log(`Registered repo ${repo.name}`);
    db.close();
  });

program.command("list-runtimes").description("List configured runtime adapters").action(() => {
  const { config } = dbForCwd();
  console.table(config.agents.agents.map((agent) => ({
    id: agent.id,
    type: agent.type,
    enabled: agent.enabled,
    capabilities: agent.capabilities.join(",")
  })));
});

program.command("test-runtime <id>").description("Run a runtime health check").action(async (id) => {
  const { config } = dbForCwd();
  const runtime = config.agents.agents.find((agent) => agent.id === id);
  if (!runtime?.command) {
    throw new Error(`Runtime not found or has no command: ${id}`);
  }
  const adapter = new ShellAdapter({
    id: runtime.id,
    label: runtime.label,
    type: runtime.type,
    command: runtime.command,
    args: runtime.args,
    capabilities: runtime.capabilities,
    logsRoot: config.app.paths.logs
  });
  console.log(await adapter.healthCheck());
});

program.command("approve <taskId>").description("Approve a task stage as owner").option("--stage <stage>", "Stage", "requirements").option("--owner <id>", "Telegram owner ID").action((taskId, options) => {
  if (!options.owner) {
    throw new Error("--owner is required until Telegram identity is available");
  }
  const { config, db } = dbForCwd();
  new ApprovalEngine(db, config.app.telegram.ownerTelegramIds).approve(Number(String(taskId).replace(/^TASK-/i, "")), options.stage, options.owner);
  console.log(`Approved ${taskId} for ${options.stage}`);
  db.close();
});

program.command("logs <taskId>").description("Show the expected logs path for a task").action((taskId) => {
  const { config } = dbForCwd();
  console.log(resolve(config.app.paths.logs, `TASK-${String(taskId).replace(/^TASK-/i, "")}`));
});

program.command("start").description("Print service start instructions").action(() => {
  console.log("Use `pnpm --filter @agent-governor/bot start`, `pnpm --filter @agent-governor/worker start`, and `pnpm --filter @agent-governor/web dev`.");
});

const worker = program.command("worker").description("Worker commands");
worker.command("start").description("Start worker").action(async () => {
  await execa("pnpm", ["--filter", "@agent-governor/worker", "start"], { stdio: "inherit" });
});

const bot = program.command("bot").description("Telegram bot commands");
bot.command("start").description("Start Telegram bot").action(async () => {
  await execa("pnpm", ["--filter", "@agent-governor/bot", "start"], { stdio: "inherit" });
});

program.command("run-task <taskId>").description("Placeholder for workflow execution").action((taskId) => {
  const { db } = dbForCwd();
  const task = new TaskStore(db).getTask(Number(String(taskId).replace(/^TASK-/i, "")));
  console.log(task);
  db.close();
});

if (!existsSync(resolve(process.cwd(), "config"))) {
  writeFileSync(resolve(process.cwd(), ".agent-governor-warning"), "Run from the Agent Governor project root.\n");
}

program.parseAsync();

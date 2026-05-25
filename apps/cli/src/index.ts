#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import { Command } from "commander";
import { loadConfig, projectRoot } from "@agent-governor/config";
import { migrate, openDb, RepoRegistry, TaskStore } from "@agent-governor/db";
import { ShellAdapter } from "@agent-governor/runtime";
import { WorkflowEngine } from "@agent-governor/workflow";

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
  .command("sync-github-repos")
  .description("Pull GitHub repositories through gh and cache them locally")
  .option("--owner <owner>", "GitHub owner/org; defaults to app config or authenticated viewer")
  .option("--limit <limit>", "Maximum repositories", "100")
  .action(async (options) => {
    const { config, db } = dbForCwd();
    const repos = await new WorkflowEngine({ db, config }).syncGithubRepos({
      owner: options.owner,
      limit: Number(options.limit)
    });
    console.log(`Synced ${repos.length} GitHub repos`);
    db.close();
  });

program.command("list-github-repos").description("List cached GitHub repositories").action(() => {
  const { db } = dbForCwd();
  const rows = new RepoRegistry(db).listGithubRepos();
  console.table(rows.map((repo) => ({
    repo: repo.name_with_owner,
    visibility: repo.private ? "private" : "public",
    branch: repo.default_branch,
    updated: repo.updated_at
  })));
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
    const { config, db } = dbForCwd();
    const root = projectRoot(process.cwd());
    const repo = new WorkflowEngine({ db, config }).registerRepo({
      name: options.name,
      githubOwner: options.owner,
      githubRepo: options.repo,
      defaultBranch: options.branch,
      localPath: resolve(root, options.path),
      owners: (options.owners ?? "").split(",").map((id: string) => id.trim()).filter(Boolean)
    });
    console.log(`Registered repo ${repo.name}`);
    db.close();
  });

program
  .command("clone-repo")
  .description("Clone and register a GitHub repository")
  .requiredOption("--name <name>", "Local registry name")
  .requiredOption("--owner <owner>", "GitHub owner or org")
  .requiredOption("--repo <repo>", "GitHub repository name")
  .option("--path <path>", "Local path; defaults to repos/<name>/main")
  .option("--branch <branch>", "Default branch", "main")
  .option("--owners <ids>", "Comma-separated Telegram owner IDs")
  .action(async (options) => {
    const { config, db } = dbForCwd();
    const root = projectRoot(process.cwd());
    const repo = await new WorkflowEngine({ db, config }).cloneRepo({
      name: options.name,
      githubOwner: options.owner,
      githubRepo: options.repo,
      defaultBranch: options.branch,
      localPath: options.path ? resolve(root, options.path) : undefined,
      owners: (options.owners ?? "").split(",").map((id: string) => id.trim()).filter(Boolean)
    });
    console.log(`Cloned and registered ${repo.name} at ${repo.local_path}`);
    db.close();
  });

program
  .command("create-repo")
  .description("Create a GitHub repo, clone it locally, initialize .ai, and register it")
  .requiredOption("--name <name>", "Repository name")
  .option("--description <description>", "GitHub repository description")
  .option("--owner <owner>", "GitHub owner or org")
  .option("--public", "Create a public repository")
  .option("--owners <ids>", "Comma-separated Telegram owner IDs")
  .action(async (options) => {
    const { config, db } = dbForCwd();
    const repo = await new WorkflowEngine({ db, config }).createGithubRepo({
      name: options.name,
      description: options.description,
      owner: options.owner,
      private: !options.public,
      owners: (options.owners ?? "").split(",").map((id: string) => id.trim()).filter(Boolean)
    });
    console.log(`Created and registered ${repo.github_owner}/${repo.github_repo}`);
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

program
  .command("create-task")
  .description("Create a task idea for a registered repo")
  .requiredOption("--repo <name>", "Registered repo name")
  .requiredOption("--title <title>", "Task title")
  .requiredOption("--description <description>", "Task description")
  .option("--actor <id>", "Actor ID", "cli")
  .action((options) => {
    const { db } = dbForCwd();
    const registry = new RepoRegistry(db);
    const repo = registry.findByName(options.repo);
    if (!repo) {
      throw new Error(`Repo not found: ${options.repo}`);
    }
    const task = new TaskStore(db).createIdea({
      repoId: repo.id,
      createdBy: options.actor,
      title: options.title,
      description: options.description
    });
    console.log(`Created TASK-${task.id}`);
    db.close();
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
  new WorkflowEngine({ db, config }).approve(Number(String(taskId).replace(/^TASK-/i, "")), options.stage, options.owner);
  console.log(`Approved ${taskId} for ${options.stage}`);
  db.close();
});

program
  .command("open-pr <taskId>")
  .description("Commit, push, and open a PR for an owner-approved task")
  .requiredOption("--owner <id>", "Telegram owner ID")
  .option("--title <title>", "PR title")
  .option("--body <body>", "PR body")
  .action(async (taskId, options) => {
    const { config, db } = dbForCwd();
    const id = Number(String(taskId).replace(/^TASK-/i, ""));
    const task = await new WorkflowEngine({ db, config }).openPullRequest(id, options.owner, {
      title: options.title,
      body: options.body
    });
    console.log(task.pr_url);
    db.close();
  });

program
  .command("merge <taskId>")
  .description("Merge an owner-approved PR")
  .requiredOption("--owner <id>", "Telegram owner ID")
  .action(async (taskId, options) => {
    const { config, db } = dbForCwd();
    const task = await new WorkflowEngine({ db, config }).mergePullRequest(
      Number(String(taskId).replace(/^TASK-/i, "")),
      options.owner
    );
    console.log(`TASK-${task.id} ${task.status}`);
    db.close();
  });

program
  .command("change <taskId>")
  .description("Request changes on a task")
  .requiredOption("--owner <id>", "Telegram owner ID")
  .requiredOption("--feedback <feedback>", "Requested changes")
  .option("--stage <stage>", "Stage", "review")
  .action(async (taskId, options) => {
    const { config, db } = dbForCwd();
    const task = await new WorkflowEngine({ db, config }).requestChanges(
      Number(String(taskId).replace(/^TASK-/i, "")),
      options.stage,
      options.owner,
      options.feedback
    );
    console.log(`TASK-${task.id} ${task.status}`);
    db.close();
  });

program
  .command("reject <taskId>")
  .description("Reject a task")
  .requiredOption("--owner <id>", "Telegram owner ID")
  .option("--stage <stage>", "Stage", "review")
  .option("--comment <comment>", "Rejection comment")
  .action(async (taskId, options) => {
    const { config, db } = dbForCwd();
    const task = await new WorkflowEngine({ db, config }).reject(
      Number(String(taskId).replace(/^TASK-/i, "")),
      options.stage,
      options.owner,
      options.comment
    );
    console.log(`TASK-${task.id} ${task.status}`);
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

program.command("run-task <taskId>").description("Advance a task through the next allowed workflow stage").action(async (taskId) => {
  const { config, db } = dbForCwd();
  const task = await new WorkflowEngine({ db, config }).advance(Number(String(taskId).replace(/^TASK-/i, "")));
  console.log(`TASK-${task.id} ${task.status} ${task.current_stage ?? ""}`.trim());
  db.close();
});

if (!existsSync(resolve(projectRoot(process.cwd()), "config"))) {
  writeFileSync(resolve(projectRoot(process.cwd()), ".agent-governor-warning"), "Run from the Agent Governor project root.\n");
}

program.parseAsync();

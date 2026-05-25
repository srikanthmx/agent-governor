import type { GovernorConfig } from "@agent-governor/config";
import { ApprovalEngine, audit, type GovernorDb, RepoRegistry, TaskStore } from "@agent-governor/db";
import { WorkflowEngine } from "@agent-governor/workflow";
import { Telegraf } from "telegraf";

export function createTelegramBot(input: { token: string; db: GovernorDb; config: GovernorConfig }): Telegraf {
  const bot = new Telegraf(input.token);
  const repos = new RepoRegistry(input.db);
  const tasks = new TaskStore(input.db);
  const approvals = new ApprovalEngine(input.db, input.config.app.telegram.ownerTelegramIds);
  const workflow = new WorkflowEngine({ db: input.db, config: input.config });
  const selections = new Map<string, string>();

  const userId = (ctx: { from?: { id: number } }) => String(ctx.from?.id ?? "");

  bot.start((ctx) => {
    ctx.reply("Agent Governor is running. Use /help for commands.");
  });

  bot.help((ctx) => {
    ctx.reply([
      "/repos",
      "/newrepo <name> <description>",
      "/selectrepo <name>",
      "/idea <text>",
      "/tasks",
      "/status <taskId>",
      "/approve <taskId>",
      "/change <taskId> <feedback>",
      "/reject <taskId>",
      "/pr <taskId>",
      "/merge <taskId>",
      "/agents",
      "/roles"
    ].join("\n"));
  });

  bot.command("repos", (ctx) => {
    const rows = repos.listRepos();
    ctx.reply(rows.length ? rows.map((repo) => `${repo.name} ${repo.github_owner}/${repo.github_repo}`).join("\n") : "No repos registered.");
  });

  bot.command("newrepo", (ctx) => {
    const actor = userId(ctx);
    approvals.requireOwner(actor);
    ctx.reply("Repo creation is scaffolded. Use CLI `agent add-repo` for this first slice.");
  });

  bot.command("selectrepo", (ctx) => {
    const name = ctx.message.text.split(/\s+/).slice(1).join(" ").trim();
    if (!name || !repos.findByName(name)) {
      ctx.reply("Usage: /selectrepo <registered-name>");
      return;
    }
    selections.set(userId(ctx), name);
    ctx.reply(`Selected ${name}`);
  });

  bot.command("idea", (ctx) => {
    const actor = userId(ctx);
    const selected = selections.get(actor);
    if (!selected) {
      ctx.reply("Select a repo first with /selectrepo <name>.");
      return;
    }
    const repo = repos.findByName(selected);
    if (!repo) {
      ctx.reply("Selected repo is no longer registered.");
      return;
    }
    const description = ctx.message.text.replace(/^\/idea(@\w+)?\s*/i, "").trim();
    if (!description) {
      ctx.reply("Usage: /idea <text>");
      return;
    }
    const title = description.split(/[.!?\n]/)[0]?.slice(0, 80) || "New idea";
    const task = tasks.createIdea({ repoId: repo.id, createdBy: actor, title, description });
    audit(input.db, { actorType: "telegram", actorId: actor, action: "task.create", entityType: "task", entityId: String(task.id) });
    ctx.reply(`Created TASK-${task.id}: ${task.title}`);
  });

  bot.command("tasks", (ctx) => {
    const rows = tasks.listTasks();
    ctx.reply(rows.length ? rows.map((task) => `TASK-${task.id} ${task.status} ${task.title}`).join("\n") : "No tasks yet.");
  });

  bot.command("status", (ctx) => {
    const id = Number(ctx.message.text.split(/\s+/)[1]?.replace(/^TASK-/i, ""));
    if (!id) {
      ctx.reply("Usage: /status <taskId>");
      return;
    }
    const task = tasks.getTask(id);
    ctx.reply(`TASK-${task.id}\nStatus: ${task.status}\nStage: ${task.current_stage ?? "none"}\nPR: ${task.pr_url ?? "none"}`);
  });

  bot.command("approve", async (ctx) => {
    const actor = userId(ctx);
    const id = Number(ctx.message.text.split(/\s+/)[1]?.replace(/^TASK-/i, ""));
    if (!id) {
      ctx.reply("Usage: /approve <taskId>");
      return;
    }
    const task = tasks.getTask(id);
    const stage = task.status === "WAITING_PR_APPROVAL" ? "pr" : task.current_stage ?? task.status;
    await workflow.approve(id, stage, actor);
    if (stage === "requirements" || stage === "design") {
      const advanced = await workflow.advance(id, actor);
      ctx.reply(`Approved TASK-${id}; advanced to ${advanced.status}`);
      return;
    }
    ctx.reply(`Approved TASK-${id} for ${stage}`);
  });

  bot.command("change", async (ctx) => {
    const actor = userId(ctx);
    const id = Number(ctx.message.text.split(/\s+/)[1]?.replace(/^TASK-/i, ""));
    if (!id) {
      ctx.reply("Usage: /change <taskId> <feedback>");
      return;
    }
    const task = tasks.getTask(id);
    const feedback = ctx.message.text.split(/\s+/).slice(2).join(" ").trim();
    await workflow.requestChanges(id, task.current_stage ?? "review", actor, feedback);
    ctx.reply(`Requested changes for TASK-${id}`);
  });

  bot.command("reject", async (ctx) => {
    const actor = userId(ctx);
    const id = Number(ctx.message.text.split(/\s+/)[1]?.replace(/^TASK-/i, ""));
    if (!id) {
      ctx.reply("Usage: /reject <taskId>");
      return;
    }
    const task = tasks.getTask(id);
    await workflow.reject(id, task.current_stage ?? "review", actor);
    ctx.reply(`Rejected TASK-${id}`);
  });

  bot.command("pr", async (ctx) => {
    const actor = userId(ctx);
    const id = Number(ctx.message.text.split(/\s+/)[1]?.replace(/^TASK-/i, ""));
    if (!id) {
      ctx.reply("Usage: /pr <taskId>");
      return;
    }
    await workflow.approve(id, "pr", actor);
    const task = await workflow.openPullRequest(id, actor);
    ctx.reply(`Opened PR for TASK-${id}: ${task.pr_url}`);
  });

  bot.command("merge", async (ctx) => {
    const actor = userId(ctx);
    const id = Number(ctx.message.text.split(/\s+/)[1]?.replace(/^TASK-/i, ""));
    if (!id) {
      ctx.reply("Usage: /merge <taskId>");
      return;
    }
    await workflow.approve(id, "merge", actor);
    const task = await workflow.mergePullRequest(id, actor);
    ctx.reply(`Merged TASK-${id}: ${task.pr_url}`);
  });

  bot.command("agents", (ctx) => {
    ctx.reply(input.config.agents.agents.map((agent) => `${agent.id} ${agent.enabled ? "enabled" : "disabled"} ${agent.type}`).join("\n") || "No agents configured.");
  });

  bot.command("roles", (ctx) => {
    ctx.reply(Object.keys(input.config.agents.roles).join("\n") || "No roles configured.");
  });

  return bot;
}

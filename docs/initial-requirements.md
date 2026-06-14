# Agent Governor Initial Requirements

Agent Governor is a local-first, cloneable, configurable AI agent governance platform.

## Goal

Build a git-cloneable local platform that lets users manage multiple GitHub repositories through Telegram and a Web UI, route work to pluggable AI coding runtimes such as OpenCode, Cline, Aider, Hermes/OpenACP-style bridges, and future API-based agents, while keeping all important actions gated by owner approval.

The product must be local-first, clone-and-run, configurable through Web UI and CLI, agent-runtime agnostic, GitHub PR-first, Telegram-first, future-proof for rapidly changing AI coding tools, minimal in custom AI logic, and maximal in wiring/plugin architecture.

## Core Principle

Do not build an AI coding agent. Do not build an IDE. Do not tightly couple to OpenCode, Cline, Hermes, ACP, Codex, Claude, or any one tool.

Build a thin governance/control plane that can plug into any runtime.

## North Star

Agent Governor should make the best locally available coding agent selectable at the moment a user writes a prompt, without compromising the approval-gated workflow. The product should keep a refreshed market view of prompt-capable CLI agents, show concrete install and setup commands, detect newly installed tools, and only route real work to agents that can be verified locally.

Expected experience:
- The dashboard prompt includes an agent selector for every prompt-runnable configured runtime.
- The setup flow keeps scanning for more CLI agents and ranks market suggestions with a daily research stamp.
- Each market suggestion includes install, setup, documentation, and suitability notes when known.
- Once an agent is installed, detected, and configured as prompt-runnable, the user can run it against a generated sample repository before trusting it with a real repo.
- Dry runs must execute in a temporary sample repo, log output under Agent Governor logs, and avoid commits, package installs, or repository mutation.

## Architecture

Interfaces:
- Telegram Bot
- Web UI
- CLI

Core backend:
- Governance API
- Repo Registry
- Approval Engine
- Workflow Engine
- Runtime Router
- Runtime Adapter Interface
- Git Worktree Manager
- GitHub Manager
- Audit Log

Execution:
- Local MacBook worker
- Runtime adapters: OpenCodeAdapter, ShellAdapter, AiderAdapter placeholder, ClineAdapter placeholder, HermesAdapter placeholder, Future API adapter placeholder

Source of truth:
- SQLite for MVP
- Easy migration path to Postgres later

UI:
- Next.js or TanStack Router app
- TanStack-inspired UI
- shadcn/ui + Tailwind
- Dense developer dashboard
- Command palette
- Tables for repos/tasks/runtimes/approvals
- Live logs panel
- Config editor

## Monorepo Structure

```text
agent-governor/
  apps/
    web/
    bot/
    cli/
    worker/

  packages/
    core/
    config/
    db/
    git/
    github/
    runtime/
    telegram/
    ui/

  config/
    app.yml
    agents.yml
    workflows.yml
    repos.yml

  data/
    agent-governor.sqlite
  logs/
  repos/
  README.md
```

## MVP Features

Setup commands:
- `pnpm install`
- `pnpm dev`
- `pnpm agent setup`
- `pnpm agent doctor`

Config files:
- `app.yml`: app name, local repo root, Telegram bot token, global owner Telegram IDs, GitHub owner/org, default branch, database path
- `agents.yml`: runtime adapters, enabled state, command, capabilities, preferred roles
- `workflows.yml`: workflow definitions, stages, approvals, output artifact expectations
- `repos.yml`: registered repos, GitHub owner/repo, local path, owners, workflow override, role override

Telegram commands:
- `/start`
- `/help`
- `/repos`
- `/newrepo <name> <description>`
- `/selectrepo <name>`
- `/idea <text>`
- `/tasks`
- `/status <taskId>`
- `/approve <taskId>`
- `/change <taskId> <feedback>`
- `/reject <taskId>`
- `/pr <taskId>`
- `/merge <taskId>`
- `/agents`
- `/roles`

Rules:
- Contributors can create ideas.
- Only configured owners can approve, reject, create repos, open PRs, and merge.
- Owner IDs must be configurable globally and per repo.
- Telegram should never directly trigger merge unless owner ID is verified.

Repo management:
- List available repos from registry.
- Create new GitHub repo using GitHub CLI or GitHub API.
- Clone repo locally into `repos/<repo-name>/main`.
- Initialize `.ai/` if missing with project, rules, architecture, standards, workflows, skills, approval, and tasks files.

Task statuses:
- `NEW`
- `CONTEXT_READY`
- `REQUIREMENTS_GENERATING`
- `WAITING_REQUIREMENTS_APPROVAL`
- `DESIGN_GENERATING`
- `WAITING_DESIGN_APPROVAL`
- `IMPLEMENTING`
- `TESTING`
- `REVIEWING`
- `FIXING`
- `PR_READY`
- `WAITING_PR_APPROVAL`
- `PR_OPENED`
- `WAITING_MERGE_APPROVAL`
- `MERGED`
- `REJECTED`
- `FAILED`

Task flow:
Telegram idea -> create task -> prepare repo context -> create worktree -> generate requirements.md -> owner approval -> generate design.md -> owner approval -> implementation -> tests -> review -> PR -> owner approval -> merge.

Every task creates:

```text
.ai/tasks/TASK-123/
  requirements.md
  design.md
  implementation-plan.md
  review.md
  decision-log.md
  agent-runs/
  logs/
```

Runtime adapter interface:

```ts
export interface RuntimeAdapter {
  id: string;
  label: string;
  type: "shell" | "opencode" | "cline" | "aider" | "hermes" | "api";
  capabilities: string[];
  healthCheck(): Promise<RuntimeHealth>;
  run(input: RuntimeRunInput): Promise<RuntimeRunResult>;
  cancel?(runId: string): Promise<void>;
}
```

Routing behavior:
- Pick first enabled runtime with required capability.
- If it fails, use fallback.
- Log every run.
- Never silently skip failures.

Git model:
- Create branch `agent/TASK-123-short-title`.
- Create worktree `repos/<repo>/worktrees/TASK-123`.
- Run all agents inside that worktree.
- Never push directly to main.
- Commit requirements and design into the task branch.
- Push branch.
- Open PR.

Security rules:
- Owner approval required before implementation.
- Owner approval required before PR open.
- Owner approval required before merge.
- No direct main push.
- All shell commands must run inside expected repo/worktree path.
- Validate task IDs.
- Sanitize branch names.
- Log all actions.
- Secrets stay in `.env` and are never committed.
- Provide `.env.example`.

## First Implementation Phase

1. Monorepo setup, config loader, SQLite schema, core types, CLI doctor, GitHub CLI wrapper, Git worktree wrapper.
2. Telegram bot, repo registry, `/repos`, `/newrepo`, `/selectrepo`, `/idea`, `/status`.
3. Workflow engine, approval engine, requirements generation using ShellAdapter initially, design generation using ShellAdapter/OpenCodeAdapter.
4. OpenCodeAdapter, task worktree, implementation run, commit/push branch, PR creation.
5. Web UI dashboard, repos, tasks, runtimes, approvals.
6. Runtime plugin polish, placeholder adapters, better logs, retry/fallback routing.

## Definition Of Done For First Usable Version

Users can clone the project, run setup, configure Telegram and GitHub, add owner Telegram IDs, create or register a GitHub repo from Telegram, submit an idea, generate and approve requirements and design, run a configured coding runtime in a git worktree, push a branch, open a PR, approve/merge only as owner, and view tasks/logs in Web UI.

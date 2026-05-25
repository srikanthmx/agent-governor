import { existsSync, readFileSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import YAML from "yaml";

export interface AppConfig {
  app: { name: string };
  paths: {
    repoRoot: string;
    database: string;
    logs: string;
  };
  telegram: {
    botToken?: string;
    ownerTelegramIds: string[];
  };
  github: {
    owner: string;
    defaultBranch: string;
  };
}

export interface AgentConfig {
  agents: Array<{
    id: string;
    label: string;
    type: "shell" | "opencode" | "cline" | "aider" | "hermes" | "api";
    enabled: boolean;
    command?: string;
    args?: string[];
    capabilities: string[];
    preferredRoles?: string[];
  }>;
  roles: Record<string, { preferred: string[]; fallback: string[] }>;
}

export interface WorkflowConfig {
  workflows: Record<string, unknown>;
}

export interface ReposConfig {
  repos: Array<{
    name: string;
    githubOwner: string;
    githubRepo: string;
    localPath: string;
    owners: string[];
    workflow?: string;
  }>;
}

export interface GovernorConfig {
  app: AppConfig;
  agents: AgentConfig;
  workflows: WorkflowConfig;
  repos: ReposConfig;
}

function readYaml<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    return fallback;
  }
  return YAML.parse(readFileSync(path, "utf8")) as T;
}

export function projectRoot(cwd = process.cwd()): string {
  let current = resolve(cwd);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(resolve(current, "pnpm-workspace.yaml")) || existsSync(resolve(current, ".git"))) {
      return current;
    }
    current = dirname(current);
  }
  return resolve(cwd);
}

export function configDir(root = projectRoot()): string {
  return resolve(projectRoot(root), "config");
}

export function loadConfig(root = projectRoot()): GovernorConfig {
  const actualRoot = projectRoot(root);
  const dir = configDir(actualRoot);
  const app = readYaml<AppConfig>(resolve(dir, "app.yml"), {
    app: { name: "Agent Governor" },
    paths: {
      repoRoot: "./repos",
      database: "./data/agent-governor.sqlite",
      logs: "./logs"
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      ownerTelegramIds: (process.env.AGENT_GOVERNOR_OWNER_TELEGRAM_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    },
    github: {
      owner: process.env.GITHUB_OWNER ?? "",
      defaultBranch: process.env.GITHUB_DEFAULT_BRANCH ?? "main"
    }
  });

  const agents = readYaml<AgentConfig>(resolve(dir, "agents.yml"), {
    agents: [],
    roles: {}
  });
  const workflows = readYaml<WorkflowConfig>(resolve(dir, "workflows.yml"), {
    workflows: {}
  });
  const repos = readYaml<ReposConfig>(resolve(dir, "repos.yml"), {
    repos: []
  });

  app.paths.repoRoot = resolve(actualRoot, app.paths.repoRoot);
  app.paths.database = resolve(actualRoot, process.env.DATABASE_PATH ?? app.paths.database);
  app.paths.logs = resolve(actualRoot, app.paths.logs);
  app.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN ?? app.telegram.botToken;

  return { app, agents, workflows, repos };
}

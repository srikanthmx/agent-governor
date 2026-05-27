import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
    detectCommand?: string;
    args?: string[];
    models?: string[];
    defaultModel?: string;
    capabilities: string[];
    preferredRoles?: string[];
    configuredEnabled?: boolean;
    detected?: boolean;
    detectedCommand?: string;
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

export interface LocalToolCatalogItem {
  id: string;
  label: string;
  kind: "agent" | "ide" | "cli" | "bridge";
  runnable: boolean;
  commandCandidates: string[];
  appCandidates?: string[];
  capabilities: string[];
}

export interface LocalToolDetection extends LocalToolCatalogItem {
  detected: boolean;
  detectedBy: string | null;
  configured: boolean;
  enabled: boolean;
}

export const localToolCatalog: LocalToolCatalogItem[] = [
  { id: "codex", label: "Codex CLI", kind: "agent", runnable: true, commandCandidates: ["codex"], appCandidates: ["/Applications/Codex.app"], capabilities: ["requirements", "design", "implementation", "review"] },
  { id: "claude", label: "Claude Code", kind: "agent", runnable: true, commandCandidates: ["claude"], capabilities: ["requirements", "design", "implementation", "review"] },
  { id: "gemini", label: "Gemini CLI", kind: "agent", runnable: true, commandCandidates: ["gemini"], capabilities: ["requirements", "design", "implementation", "review"] },
  { id: "opencode", label: "OpenCode", kind: "agent", runnable: true, commandCandidates: ["opencode"], capabilities: ["requirements", "design", "implementation", "review"] },
  { id: "aider", label: "Aider", kind: "agent", runnable: true, commandCandidates: ["aider"], capabilities: ["implementation", "review"] },
  { id: "cline", label: "Cline", kind: "ide", runnable: false, commandCandidates: ["cline"], capabilities: ["design", "review"] },
  { id: "kiro", label: "Kiro", kind: "ide", runnable: false, commandCandidates: ["kiro"], appCandidates: ["/Applications/Kiro.app"], capabilities: ["design", "implementation", "review"] },
  { id: "antigravity", label: "Google Antigravity", kind: "ide", runnable: false, commandCandidates: ["antigravity"], appCandidates: ["/Applications/Antigravity.app", "/Applications/Google Antigravity.app"], capabilities: ["design", "implementation", "review"] },
  { id: "cursor", label: "Cursor", kind: "ide", runnable: false, commandCandidates: ["cursor"], appCandidates: ["/Applications/Cursor.app"], capabilities: ["design", "implementation", "review"] },
  { id: "windsurf", label: "Windsurf", kind: "ide", runnable: false, commandCandidates: ["windsurf"], appCandidates: ["/Applications/Windsurf.app"], capabilities: ["design", "implementation", "review"] },
  { id: "continue", label: "Continue", kind: "bridge", runnable: false, commandCandidates: ["continue"], capabilities: ["review"] },
  { id: "zed", label: "Zed", kind: "ide", runnable: false, commandCandidates: ["zed"], appCandidates: ["/Applications/Zed.app"], capabilities: ["design", "implementation"] },
  { id: "code", label: "VS Code", kind: "ide", runnable: false, commandCandidates: ["code"], appCandidates: ["/Applications/Visual Studio Code.app"], capabilities: ["design", "implementation"] },
  { id: "jetbrains", label: "JetBrains IDE", kind: "ide", runnable: false, commandCandidates: ["idea", "webstorm", "pycharm"], appCandidates: ["/Applications/IntelliJ IDEA.app", "/Applications/WebStorm.app", "/Applications/PyCharm.app"], capabilities: ["design", "implementation"] },
  { id: "gh", label: "GitHub CLI", kind: "cli", runnable: false, commandCandidates: ["gh"], capabilities: ["pr", "merge"] },
  { id: "tmux", label: "tmux", kind: "cli", runnable: false, commandCandidates: ["tmux"], capabilities: ["terminal"] }
];

function readYaml<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    return fallback;
  }
  return YAML.parse(readFileSync(path, "utf8")) as T;
}

const detectCommandByAgentId: Record<string, string> = {
  aider: "aider",
  claude: "claude",
  cline: "cline",
  codex: "codex",
  gemini: "gemini",
  opencode: "opencode"
};

function commandExists(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${JSON.stringify(command)} >/dev/null 2>&1`], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function detectCatalogItem(item: LocalToolCatalogItem): { detected: boolean; detectedBy: string | null } {
  for (const command of item.commandCandidates) {
    if (commandExists(command)) {
      return { detected: true, detectedBy: command };
    }
  }
  for (const app of item.appCandidates ?? []) {
    if (existsSync(app)) {
      return { detected: true, detectedBy: app };
    }
  }
  return { detected: false, detectedBy: null };
}

export function detectLocalTools(config?: AgentConfig): LocalToolDetection[] {
  return localToolCatalog.map((item) => {
    const detection = detectCatalogItem(item);
    const configuredAgent = config?.agents.find((agent) => agent.id === item.id);
    return {
      ...item,
      detected: detection.detected,
      detectedBy: detection.detectedBy,
      configured: Boolean(configuredAgent),
      enabled: Boolean(configuredAgent?.enabled || configuredAgent?.detected || (item.runnable && detection.detected))
    };
  });
}

function detectionCommandFor(agent: AgentConfig["agents"][number]): string | undefined {
  return agent.detectCommand ?? detectCommandByAgentId[agent.id] ?? (agent.command && agent.command !== "sh" ? agent.command : undefined);
}

function applyAgentDetection(agents: AgentConfig): AgentConfig {
  return {
    ...agents,
    agents: agents.agents.map((agent) => {
      const detectCommand = detectionCommandFor(agent);
      const catalogMatch = localToolCatalog.find((item) => item.id === agent.id);
      const catalogDetection = catalogMatch ? detectCatalogItem(catalogMatch) : { detected: false, detectedBy: null };
      const detected = detectCommand ? commandExists(detectCommand) || catalogDetection.detected : catalogDetection.detected;
      return {
        ...agent,
        configuredEnabled: agent.enabled,
        enabled: Boolean(agent.enabled || detected),
        detected,
        detectedCommand: catalogDetection.detectedBy ?? detectCommand
      };
    })
  };
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

  const agents = applyAgentDetection(readYaml<AgentConfig>(resolve(dir, "agents.yml"), {
    agents: [],
    roles: {}
  }));
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

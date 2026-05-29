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
    executionMode?: "headless" | "interactive";
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
  executionMode?: "headless" | "interactive";
  installCommand?: string;
  installUrl?: string;
  setupCommand?: string;
  notes?: string;
}

export interface LocalToolDetection extends LocalToolCatalogItem {
  detected: boolean;
  detectedBy: string | null;
  configured: boolean;
  enabled: boolean;
  promptRunnable: boolean;
  status: "runnable" | "missing_cli" | "bridge_required" | "disabled";
  reason: string;
}

export const localToolCatalog: LocalToolCatalogItem[] = [
  { id: "codex", label: "Codex CLI", kind: "agent", runnable: true, commandCandidates: ["codex"], appCandidates: ["/Applications/Codex.app"], capabilities: ["requirements", "design", "implementation", "review"], installUrl: "https://openai.com/codex/", setupCommand: "codex login", notes: "Uses local Codex CLI authentication/subscription." },
  { id: "claude", label: "Claude Code", kind: "agent", runnable: true, commandCandidates: ["claude"], capabilities: ["requirements", "design", "implementation", "review"], installCommand: "brew install --cask claude-code", installUrl: "https://code.claude.com/docs/en/setup", setupCommand: "claude", notes: "Official Anthropic terminal coding agent." },
  { id: "gemini", label: "Gemini CLI", kind: "agent", runnable: true, commandCandidates: ["gemini"], capabilities: ["requirements", "design", "implementation", "review"], installCommand: "npm install -g @google/gemini-cli", installUrl: "https://github.com/google-gemini/gemini-cli", setupCommand: "gemini", notes: "Official Google Gemini terminal agent." },
  { id: "opencode", label: "OpenCode", kind: "agent", runnable: true, commandCandidates: ["opencode"], capabilities: ["requirements", "design", "implementation", "review"], installCommand: "curl -fsSL https://opencode.ai/install | bash", installUrl: "https://opencode.ai/docs/", setupCommand: "opencode auth login", notes: "Open source terminal coding agent with `opencode run`." },
  { id: "aider", label: "Aider", kind: "agent", runnable: true, commandCandidates: ["aider"], capabilities: ["implementation", "review"], installCommand: "python -m pip install aider-install && aider-install", installUrl: "https://aider.chat/docs/install.html", setupCommand: "aider", notes: "Open source CLI pair programmer." },
  { id: "goose", label: "Goose", kind: "agent", runnable: true, commandCandidates: ["goose"], capabilities: ["requirements", "design", "implementation", "review"], installCommand: "brew install block-goose-cli", installUrl: "https://block.github.io/goose/docs/getting-started/installation/", setupCommand: "goose configure", notes: "Local extensible coding agent from Block." },
  { id: "qwen-code", label: "Qwen Code", kind: "agent", runnable: true, commandCandidates: ["qwen", "qwen-code"], capabilities: ["requirements", "design", "implementation", "review"], installCommand: "npm install -g @qwen-code/qwen-code", installUrl: "https://github.com/QwenLM/qwen-code", setupCommand: "qwen", notes: "Terminal coding agent in the Qwen ecosystem." },
  { id: "amp", label: "Amp", kind: "agent", runnable: true, commandCandidates: ["amp"], capabilities: ["requirements", "design", "implementation", "review"], installUrl: "https://ampcode.com/", setupCommand: "amp", notes: "CLI coding agent; install details may vary by account." },
  { id: "amazon-q", label: "Amazon Q Developer CLI", kind: "agent", runnable: true, commandCandidates: ["q"], capabilities: ["requirements", "design", "implementation", "review"], installUrl: "https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.html", setupCommand: "q login", notes: "AWS local CLI coding assistant." },
  { id: "openhands", label: "OpenHands", kind: "agent", runnable: true, commandCandidates: ["openhands"], capabilities: ["requirements", "design", "implementation", "review"], installUrl: "https://docs.all-hands.dev/", notes: "Open source software engineering agent; often run via Docker or server mode." },
  { id: "cline", label: "Cline", kind: "ide", runnable: false, commandCandidates: ["cline"], capabilities: ["design", "review"], installUrl: "https://cline.bot/", notes: "IDE extension; needs a bridge before Agent Governor can route prompts." },
  { id: "roo-code", label: "Roo Code", kind: "ide", runnable: false, commandCandidates: ["roo"], capabilities: ["design", "implementation", "review"], installUrl: "https://roocode.com/", notes: "IDE extension; needs a bridge before prompt routing." },
  { id: "kiro", label: "Kiro", kind: "ide", runnable: false, commandCandidates: ["kiro"], appCandidates: ["/Applications/Kiro.app"], capabilities: ["design", "implementation", "review"], installUrl: "https://kiro.dev/", notes: "GUI IDE agent; bridge required for remote prompt routing." },
  { id: "antigravity", label: "Google Antigravity", kind: "agent", runnable: true, commandCandidates: ["antigravity"], appCandidates: ["/Applications/Antigravity.app", "/Applications/Google Antigravity.app"], capabilities: ["interactive"], executionMode: "interactive", installUrl: "https://antigravity.google/", notes: "Interactive CLI chat target. Opens Antigravity UI; not headless artifact generation." },
  { id: "cursor", label: "Cursor", kind: "ide", runnable: false, commandCandidates: ["cursor"], appCandidates: ["/Applications/Cursor.app"], capabilities: ["design", "implementation", "review"], installUrl: "https://cursor.com/", notes: "GUI IDE; use only after a prompt bridge is configured." },
  { id: "windsurf", label: "Windsurf", kind: "ide", runnable: false, commandCandidates: ["windsurf"], appCandidates: ["/Applications/Windsurf.app"], capabilities: ["design", "implementation", "review"], installUrl: "https://windsurf.com/", notes: "GUI IDE; use only after a prompt bridge is configured." },
  { id: "continue", label: "Continue", kind: "bridge", runnable: false, commandCandidates: ["continue"], capabilities: ["review"], installUrl: "https://docs.continue.dev/", notes: "Assistant framework; bridge work needed for governed prompt routing." },
  { id: "zed", label: "Zed", kind: "ide", runnable: false, commandCandidates: ["zed"], appCandidates: ["/Applications/Zed.app"], capabilities: ["design", "implementation"], installUrl: "https://zed.dev/", notes: "IDE with agent integrations; bridge/ACP integration required." },
  { id: "code", label: "VS Code", kind: "ide", runnable: false, commandCandidates: ["code"], appCandidates: ["/Applications/Visual Studio Code.app"], capabilities: ["design", "implementation"], installUrl: "https://code.visualstudio.com/", notes: "Editor shell, not a prompt agent by itself." },
  { id: "jetbrains", label: "JetBrains IDE", kind: "ide", runnable: false, commandCandidates: ["idea", "webstorm", "pycharm"], appCandidates: ["/Applications/IntelliJ IDEA.app", "/Applications/WebStorm.app", "/Applications/PyCharm.app"], capabilities: ["design", "implementation"], installUrl: "https://www.jetbrains.com/ai/", notes: "IDE assistant surface; bridge required." },
  { id: "junie", label: "JetBrains Junie", kind: "ide", runnable: false, commandCandidates: ["junie"], capabilities: ["design", "implementation", "review"], installUrl: "https://www.jetbrains.com/junie/", notes: "JetBrains agent; bridge required for prompt routing." },
  { id: "copilot", label: "GitHub Copilot", kind: "ide", runnable: false, commandCandidates: ["gh"], capabilities: ["review"], installUrl: "https://docs.github.com/en/copilot", notes: "Copilot surfaces vary; not treated as repo-editing CLI adapter yet." },
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

function commandOutput(command: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 10_000
  });
  return {
    ok: result.status === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n")
  };
}

function promptCapabilityCheck(id: string, command: string): { ok: boolean; reason: string } {
  if (id === "codex") {
    const result = commandOutput(command, ["exec", "--help"]);
    return {
      ok: result.ok && result.output.includes("Run Codex non-interactively"),
      reason: result.ok ? "codex exec is available" : "codex exec is not available"
    };
  }
  if (id === "antigravity") {
    const result = commandOutput(command, ["chat", "--help"]);
    return {
      ok: result.ok && result.output.includes("Usage: antigravity chat"),
      reason: result.ok ? "antigravity chat is available" : "antigravity chat is not available"
    };
  }
  if (["claude", "gemini", "opencode", "aider"].includes(id)) {
    const result = commandOutput(command, ["--help"]);
    return {
      ok: result.ok,
      reason: result.ok ? `${command} CLI is available` : `${command} CLI did not respond to --help`
    };
  }
  return { ok: true, reason: `${command} exists` };
}

function verifyCatalogItem(item: LocalToolCatalogItem, config?: AgentConfig): LocalToolDetection {
  const configuredAgent = config?.agents.find((agent) => agent.id === item.id);
  const commandCandidates = [
    configuredAgent?.detectCommand,
    ...(configuredAgent?.command && configuredAgent.command !== "sh" ? [configuredAgent.command] : []),
    ...item.commandCandidates
  ].filter((value): value is string => Boolean(value));
  const detectedCommand = commandCandidates.find((command) => commandExists(command)) ?? null;
  const appDetection = detectCatalogItem({ ...item, commandCandidates: [] });
  const detectedBy = detectedCommand ?? appDetection.detectedBy;
  const detected = Boolean(detectedBy);

  if (!item.runnable) {
    return {
      ...item,
      detected,
      detectedBy,
      configured: Boolean(configuredAgent),
      enabled: false,
      promptRunnable: false,
      status: detected ? "bridge_required" : "disabled",
      reason: detected ? "Detected locally, but no prompt bridge is configured" : "Not found locally"
    };
  }

  if (!detectedCommand) {
    return {
      ...item,
      detected,
      detectedBy,
      configured: Boolean(configuredAgent),
      enabled: false,
      promptRunnable: false,
      status: "missing_cli",
      reason: detectedBy ? "App found, but no prompt-capable CLI command is on PATH" : "No prompt-capable CLI command found"
    };
  }

  const promptCheck = promptCapabilityCheck(item.id, detectedCommand);
  return {
    ...item,
    detected: true,
    detectedBy: detectedCommand,
    configured: Boolean(configuredAgent),
    enabled: promptCheck.ok,
    promptRunnable: promptCheck.ok,
    status: promptCheck.ok ? "runnable" : "missing_cli",
    reason: promptCheck.reason
  };
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
  return localToolCatalog.map((item) => verifyCatalogItem(item, config));
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
      const commandDetected = detectCommand ? commandExists(detectCommand) : false;
      const verified = catalogMatch ? verifyCatalogItem(catalogMatch, agents) : null;
      const detected = commandDetected || (!catalogMatch?.runnable && catalogDetection.detected);
      return {
        ...agent,
        configuredEnabled: agent.enabled,
        enabled: Boolean(verified?.promptRunnable || (!catalogMatch && agent.enabled && detected)),
        detected,
        detectedCommand: commandDetected ? detectCommand : (catalogDetection.detectedBy ?? undefined)
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

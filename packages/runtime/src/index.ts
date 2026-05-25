import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { execa } from "execa";
import type {
  RuntimeAdapter,
  RuntimeHealth,
  RuntimeRunInput,
  RuntimeRunResult,
  RuntimeType
} from "@agent-governor/core";

export interface RuntimeCommandConfig {
  id: string;
  label: string;
  type: RuntimeType;
  command: string;
  args?: string[];
  capabilities: string[];
  logsRoot: string;
}

function assertInsideWorktree(cwd: string, worktreePath: string): void {
  const resolvedCwd = resolve(cwd);
  const resolvedWorktree = resolve(worktreePath);
  if (!resolvedCwd.startsWith(resolvedWorktree)) {
    throw new Error(`Runtime cwd must stay inside worktree: ${resolvedWorktree}`);
  }
}

export class ShellAdapter implements RuntimeAdapter {
  readonly id: string;
  readonly label: string;
  readonly type: RuntimeType;
  readonly capabilities: string[];

  constructor(private readonly config: RuntimeCommandConfig) {
    this.id = config.id;
    this.label = config.label;
    this.type = config.type;
    this.capabilities = config.capabilities;
  }

  async healthCheck(): Promise<RuntimeHealth> {
    try {
      await execa(this.config.command, ["--version"], { reject: false });
      return { ok: true, message: `${this.config.command} is available`, checkedAt: new Date().toISOString() };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() };
    }
  }

  async run(input: RuntimeRunInput): Promise<RuntimeRunResult> {
    assertInsideWorktree(input.worktreePath, input.worktreePath);
    const runId = randomUUID();
    const runDir = join(this.config.logsRoot, input.taskId, runId);
    mkdirSync(runDir, { recursive: true });
    const promptPath = join(runDir, "prompt.md");
    const stdoutPath = join(runDir, "stdout.log");
    const stderrPath = join(runDir, "stderr.log");
    writeFileSync(promptPath, input.prompt);

    const args = (this.config.args ?? []).map((arg) => arg.replaceAll("{promptFile}", promptPath));
    const child = spawn(this.config.command, args, {
      cwd: input.worktreePath,
      env: { ...process.env, AGENT_GOVERNOR_PROMPT_FILE: promptPath },
      stdio: ["pipe", "pipe", "pipe"]
    });

    child.stdin.write(input.prompt);
    child.stdin.end();
    child.stdout.pipe(createWriteStream(stdoutPath));
    child.stderr.pipe(createWriteStream(stderrPath));

    const exitCode = await new Promise<number | null>((resolvePromise) => {
      child.on("close", resolvePromise);
    });

    const artifacts = input.outputPath ? [input.outputPath] : [];
    if (input.outputPath) {
      mkdirSync(dirname(input.outputPath), { recursive: true });
    }

    return {
      runId,
      status: exitCode === 0 ? "success" : "failed",
      artifacts,
      logsPath: runDir,
      summary: `Command ${this.config.command} exited with ${exitCode}`,
      error: exitCode === 0 ? undefined : `Runtime failed with exit code ${exitCode}`
    };
  }
}

export class PlaceholderAdapter implements RuntimeAdapter {
  readonly capabilities: string[];

  constructor(
    readonly id: string,
    readonly label: string,
    readonly type: RuntimeType,
    capabilities: string[] = []
  ) {
    this.capabilities = capabilities;
  }

  async healthCheck(): Promise<RuntimeHealth> {
    return {
      ok: false,
      message: `${this.label} adapter is a placeholder`,
      checkedAt: new Date().toISOString()
    };
  }

  async run(): Promise<RuntimeRunResult> {
    return {
      runId: randomUUID(),
      status: "failed",
      artifacts: [],
      logsPath: "",
      error: `${this.label} adapter is not implemented yet`
    };
  }
}

export class RuntimeRouter {
  constructor(private readonly adapters: RuntimeAdapter[]) {}

  list(): RuntimeAdapter[] {
    return this.adapters;
  }

  pick(input: { preferred: string[]; fallback: string[]; capability: string }): RuntimeAdapter | undefined {
    const orderedIds = [...input.preferred, ...input.fallback];
    return orderedIds
      .map((id) => this.adapters.find((adapter) => adapter.id === id))
      .find((adapter): adapter is RuntimeAdapter => Boolean(adapter?.capabilities.includes(input.capability)));
  }

  async runWithFallback(input: {
    preferred: string[];
    fallback: string[];
    capability: string;
    runInput: RuntimeRunInput;
  }): Promise<RuntimeRunResult> {
    const failures: string[] = [];
    for (const id of [...input.preferred, ...input.fallback]) {
      const adapter = this.adapters.find((candidate) => candidate.id === id);
      if (!adapter || !adapter.capabilities.includes(input.capability)) {
        continue;
      }
      const result = await adapter.run(input.runInput);
      if (result.status === "success") {
        return result;
      }
      failures.push(`${id}: ${result.error ?? result.status}`);
    }
    return {
      runId: randomUUID(),
      status: "failed",
      artifacts: [],
      logsPath: "",
      error: failures.length ? failures.join("\n") : "No enabled runtime matched the requested capability"
    };
  }
}

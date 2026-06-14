import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const projectRoot = existsSync(join(cwd, "vendor", "hermes-agent")) ? cwd : join(cwd, "..", "..");
const hermesRoot = join(projectRoot, "vendor", "hermes-agent");
const sidecarDir = join(projectRoot, "data", "sidecars");
const logDir = join(projectRoot, "logs");
const pidPath = join(sidecarDir, "hermes.pid");
const logPath = join(logDir, "hermes-sidecar.log");
const hermesHome = join(projectRoot, "data", "hermes-home");

export type HermesSidecarStatus = {
  installed: boolean;
  configured: boolean;
  running: boolean;
  pid: number | null;
  baseUrl: string;
  apiKeySet: boolean;
  health: "ok" | "unreachable" | "unknown";
  repoPath: string;
  logPath: string;
  setupCommand: string;
  startCommand: string;
  message: string;
};

export function hermesBaseUrl(): string {
  return `http://${process.env.HERMES_SIDECAR_HOST ?? "127.0.0.1"}:${process.env.HERMES_SIDECAR_PORT ?? "8642"}`;
}

export function hermesApiKey(): string {
  return process.env.HERMES_SIDECAR_KEY ?? "change-me-local-dev";
}

export function hermesSetupCommand(): string {
  return "cd vendor/hermes-agent && uv venv .venv --python 3.11 && uv pip install -e '.[web]'";
}

export function hermesStartCommand(): string {
  return "HERMES_HOME=../../data/hermes-home API_SERVER_ENABLED=true API_SERVER_KEY=change-me-local-dev .venv/bin/python -m hermes_cli.main gateway";
}

export async function getHermesSidecarStatus(): Promise<HermesSidecarStatus> {
  const installed = existsSync(join(hermesRoot, ".git"));
  const configured = existsSync(hermesPythonPath());
  const pid = readPid();
  const running = Boolean(pid && isPidAlive(pid));
  const health = running ? await healthState() : "unknown";

  return {
    installed,
    configured,
    running,
    pid: running ? pid : null,
    baseUrl: hermesBaseUrl(),
    apiKeySet: Boolean(hermesApiKey()),
    health,
    repoPath: hermesRoot,
    logPath,
    setupCommand: hermesSetupCommand(),
    startCommand: hermesStartCommand(),
    message: statusMessage({ installed, configured, running, health })
  };
}

export async function startHermesSidecar() {
  const status = await getHermesSidecarStatus();
  if (status.running) {
    return { ok: true, status, action: "already_running" };
  }
  if (!status.installed) {
    return { ok: false, status, action: "missing_repo", error: "Hermes repo is not cloned under vendor/hermes-agent." };
  }
  if (!status.configured) {
    return {
      ok: false,
      status,
      action: "setup_required",
      error: "Hermes dependencies are not installed yet. Run the setup command or call the bootstrap endpoint."
    };
  }

  ensureDirs();
  const out = openLogFd();
  const child = spawn(hermesPythonPath(), ["-m", "hermes_cli.main", "gateway"], {
    cwd: hermesRoot,
    detached: true,
    stdio: ["ignore", out, out],
    env: hermesSidecarEnv()
  });
  child.unref();
  writeFileSync(pidPath, String(child.pid));

  await delay(1200);
  return { ok: true, action: "started", status: await getHermesSidecarStatus() };
}

export async function stopHermesSidecar() {
  const pid = readPid();
  if (!pid || !isPidAlive(pid)) {
    removePid();
    return { ok: true, action: "not_running", status: await getHermesSidecarStatus() };
  }

  process.kill(pid, "SIGTERM");
  await delay(800);
  if (isPidAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
  removePid();
  return { ok: true, action: "stopped", status: await getHermesSidecarStatus() };
}

export async function bootstrapHermesSidecar() {
  const status = await getHermesSidecarStatus();
  if (!status.installed) {
    return { ok: false, action: "missing_repo", status, error: "Hermes repo is not cloned under vendor/hermes-agent." };
  }
  if (status.configured) {
    return { ok: true, action: "already_configured", status };
  }

  ensureDirs();
  const out = openLogFd();
  const child = spawn("uv", ["venv", ".venv", "--python", "3.11"], {
    cwd: hermesRoot,
    detached: true,
    stdio: ["ignore", out, out]
  });
  const exitCode = await waitForProcess(child);
  if (exitCode !== 0) {
    return { ok: false, action: "venv_failed", status: await getHermesSidecarStatus(), error: `uv venv exited ${exitCode}` };
  }

  const install = spawn("uv", ["pip", "install", "-e", ".[web]"], {
    cwd: hermesRoot,
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, VIRTUAL_ENV: join(hermesRoot, ".venv") }
  });
  const installExit = await waitForProcess(install);
  return {
    ok: installExit === 0,
    action: installExit === 0 ? "configured" : "install_failed",
    status: await getHermesSidecarStatus(),
    error: installExit === 0 ? undefined : `uv pip install exited ${installExit}`
  };
}

export async function proxyHermes(path: string, init?: RequestInit) {
  return fetch(`${hermesBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${hermesApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
}

function hermesSidecarEnv() {
  const env = { ...process.env };
  delete env.TELEGRAM_BOT_TOKEN;
  delete env.TELEGRAM_ALLOWED_USERS;
  return {
    ...env,
    HERMES_HOME: hermesHome,
    API_SERVER_ENABLED: "true",
    API_SERVER_KEY: hermesApiKey(),
    API_SERVER_CORS_ORIGINS: process.env.HERMES_SIDECAR_CORS_ORIGINS ?? "http://localhost:3004,http://127.0.0.1:3004"
  };
}

function hermesPythonPath(): string {
  return join(hermesRoot, ".venv", "bin", "python");
}

function ensureDirs() {
  mkdirSync(sidecarDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  mkdirSync(hermesHome, { recursive: true });
}

function openLogFd() {
  ensureDirs();
  return openSync(logPath, "a");
}

function readPid(): number | null {
  if (!existsSync(pidPath)) return null;
  const pid = Number(readFileSync(pidPath, "utf8").trim());
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function removePid() {
  if (existsSync(pidPath)) {
    unlinkSync(pidPath);
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function healthState(): Promise<HermesSidecarStatus["health"]> {
  try {
    const res = await fetch(`${hermesBaseUrl()}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

function statusMessage(input: { installed: boolean; configured: boolean; running: boolean; health: HermesSidecarStatus["health"] }) {
  if (!input.installed) return "Hermes repo has not been cloned.";
  if (!input.configured) return "Hermes repo is cloned, but dependencies are not installed.";
  if (!input.running) return "Hermes is configured but not running.";
  if (input.health !== "ok") return "Hermes process is running, but its API health endpoint is not reachable.";
  return "Hermes API sidecar is running and reachable.";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcess(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code));
  });
}

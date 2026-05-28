const { app, BrowserWindow, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const DEFAULT_PORT = Number(process.env.AGENT_GOVERNOR_DESKTOP_PORT || "3002");
const EXTERNAL_URL_PATTERN = /^https?:\/\/(?!localhost(?::\d+)?(?:\/|$)|127\.0\.0\.1(?::\d+)?(?:\/|$))/i;

/** @type {import("node:child_process").ChildProcess | null} */
let webProcess = null;
/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;

function findProjectRoot() {
  let current = resolve(__dirname, "..", "..", "..");
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const next = resolve(current, "..");
    if (next === current) {
      break;
    }
    current = next;
  }
  return resolve(__dirname, "..", "..", "..");
}

function localUrl(port = DEFAULT_PORT) {
  return process.env.AGENT_GOVERNOR_WEB_URL || `http://localhost:${port}`;
}

/**
 * @param {string} url
 */
async function isWebReady(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 */
async function waitForWeb(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isWebReady(url)) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Timed out waiting for Agent Governor web app at ${url}`);
}

async function ensureWebServer() {
  const url = localUrl();
  if (await isWebReady(url)) {
    return url;
  }

  const root = findProjectRoot();
  webProcess = spawn("pnpm", ["--filter", "@agent-governor/web", "dev", "--", "-p", String(DEFAULT_PORT)], {
    cwd: root,
    env: {
      ...process.env,
      AGENT_GOVERNOR_DESKTOP: "1",
      BROWSER: "none"
    },
    stdio: "inherit"
  });

  webProcess.once("exit", (code, signal) => {
    webProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-governor:web-exit", { code, signal });
    }
  });

  await waitForWeb(url);
  return url;
}

/**
 * @param {string} url
 */
function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: "Agent Governor",
    backgroundColor: "#090a07",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (EXTERNAL_URL_PATTERN.test(targetUrl)) {
      shell.openExternal(targetUrl);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (EXTERNAL_URL_PATTERN.test(targetUrl)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });
}

function installMenu() {
  /** @type {Array<import("electron").MenuItemConstructorOptions>} */
  const template = [
    {
      label: "Agent Governor",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  installMenu();
  const url = await ensureWebServer();
  createWindow(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(url);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (webProcess) {
    webProcess.kill("SIGTERM");
    webProcess = null;
  }
});

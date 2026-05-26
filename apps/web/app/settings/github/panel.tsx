"use client";

import { useEffect, useState } from "react";

interface AuthState {
  authenticated?: boolean;
  output?: string;
  code?: string;
  url?: string;
  pending?: boolean;
  done?: boolean;
  error?: string;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return { ok: false, error: `Empty response from ${response.url}` };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

export function GitHubAuthPanel() {
  const [auth, setAuth] = useState<AuthState>({});
  const [syncResult, setSyncResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function checkStatus() {
      const response = await fetch("/api/github/status", { cache: "no-store" });
    setAuth(await readJsonResponse(response));
  }

  async function startLogin() {
    setBusy(true);
    setSyncResult("");
    try {
      const response = await fetch("/api/github/auth", { method: "POST" });
      setAuth(await readJsonResponse(response));
    } finally {
      setBusy(false);
    }
  }

  async function refreshLogin() {
    const response = await fetch("/api/github/auth", { cache: "no-store" });
    const login = await readJsonResponse(response);
    setAuth((current) => ({ ...current, ...login }));
    if (login.done) {
      await checkStatus();
    }
  }

  async function syncRepos() {
    setBusy(true);
    try {
      const response = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 })
      });
      const result = await readJsonResponse(response);
      setSyncResult(result.ok ? `Synced ${result.count} repositories` : result.error ?? "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-zinc-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase text-zinc-400">Authentication</h2>
            <p className="mt-1 text-sm text-zinc-500">{auth.authenticated ? "GitHub CLI is authenticated." : "GitHub CLI is not authenticated."}</p>
          </div>
          <div className="flex gap-2">
            <button className="h-9 rounded-md border border-zinc-700 px-3 text-sm" disabled={busy} onClick={checkStatus}>Check</button>
            <button className="h-9 rounded-md bg-zinc-100 px-3 text-sm text-zinc-950" disabled={busy} onClick={startLogin}>Start Login</button>
          </div>
        </div>

        {auth.code ? (
          <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-400">Open GitHub device login and enter this code:</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded bg-black px-3 py-2 font-mono text-lg">{auth.code}</code>
              <a className="rounded-md border border-zinc-700 px-3 py-2 text-sm" href={auth.url ?? "https://github.com/login/device"} target="_blank">Open GitHub</a>
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm" onClick={refreshLogin}>I Approved It</button>
            </div>
          </div>
        ) : null}

        {auth.output ? <pre className="mt-4 max-h-56 overflow-auto rounded bg-black p-3 text-xs text-zinc-400">{auth.output}</pre> : null}
      </section>

      <section className="rounded-md border border-zinc-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase text-zinc-400">Repository Sync</h2>
            <p className="mt-1 text-sm text-zinc-500">Pull repositories from GitHub into the local SQLite cache.</p>
          </div>
          <button className="h-9 rounded-md bg-zinc-100 px-3 text-sm text-zinc-950" disabled={busy || !auth.authenticated} onClick={syncRepos}>Sync Repos</button>
        </div>
        {syncResult ? <p className="mt-3 text-sm text-zinc-300">{syncResult}</p> : null}
      </section>
    </div>
  );
}

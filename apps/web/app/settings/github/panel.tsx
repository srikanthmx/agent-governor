"use client";

import { useEffect, useState } from "react";

interface AuthState {
  authenticated?: boolean;
  provider?: string;
  output?: string;
  code?: string;
  url?: string;
  authUrl?: string;
  callbackUrl?: string;
  oauthConfigured?: boolean;
  setupRequired?: boolean;
  pending?: boolean;
  done?: boolean;
  error?: string;
  web?: boolean;
  login?: string;
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
    const status = await readJsonResponse(response);
    if (status.authenticated) {
      setAuth(status);
      return;
    }
    const authResponse = await fetch("/api/github/auth", { cache: "no-store" });
    const authMeta = await readJsonResponse(authResponse);
    setAuth({ ...status, ...authMeta });
  }

  async function startLogin() {
    setBusy(true);
    setSyncResult("");
    try {
      const response = await fetch("/api/github/auth", { method: "POST" });
      const result = await readJsonResponse(response);
      if (result.authUrl) {
        window.location.href = result.authUrl;
        return;
      }
      setAuth(result);
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
        body: JSON.stringify({})
      });
      const result = await readJsonResponse(response);
      setSyncResult(result.ok ? `Synced ${result.count} repositories` : result.error ?? "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectGitHub() {
    setBusy(true);
    setSyncResult("");
    try {
      const response = await fetch("/api/github/auth", { method: "DELETE" });
      const result = await readJsonResponse(response);
      setSyncResult(result.message ?? "GitHub disconnected.");
      await checkStatus();
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
            <p className="mt-1 text-sm text-zinc-500">
              {auth.authenticated
                ? `GitHub is authenticated${auth.login ? ` as ${auth.login}` : ""}.`
                : "GitHub is not authenticated. Sign in with browser SSO after the OAuth app is configured."}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="h-9 rounded-md border border-zinc-700 px-3 text-sm" disabled={busy} onClick={checkStatus}>Check</button>
            {auth.authenticated ? (
              <button className="h-9 rounded-md border border-zinc-700 px-3 text-sm" disabled={busy} onClick={disconnectGitHub}>Disconnect</button>
            ) : null}
            <button className="h-9 rounded-md bg-zinc-100 px-3 text-sm text-zinc-950" disabled={busy || auth.setupRequired} onClick={startLogin}>Sign in with GitHub</button>
          </div>
        </div>

        {auth.setupRequired ? (
          <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm font-medium text-zinc-200">GitHub browser SSO needs one-time setup.</p>
            <p className="mt-1 text-sm text-zinc-500">Create a GitHub OAuth App, add this callback URL, set the env vars, then restart the app.</p>
            <div className="mt-3 space-y-2 text-xs text-zinc-400">
              <div>
                Callback URL: <code className="rounded bg-black px-2 py-1 text-zinc-200">{auth.callbackUrl ?? "/api/github/callback"}</code>
              </div>
              <div>
                Required env: <code className="rounded bg-black px-2 py-1 text-zinc-200">GITHUB_CLIENT_ID</code>{" "}
                <code className="rounded bg-black px-2 py-1 text-zinc-200">GITHUB_CLIENT_SECRET</code>
              </div>
            </div>
            {auth.error ? <p className="mt-3 text-xs text-zinc-500">{auth.error}</p> : null}
          </div>
        ) : null}

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

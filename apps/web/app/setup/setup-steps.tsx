"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; name: string; github: string };
type GithubRepo = { id: number; nameWithOwner: string; description: string; visibility: string; defaultBranch: string; url: string };

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  return text ? JSON.parse(text) : { ok: false, error: "Empty response" };
}

interface AuthState {
  authenticated?: boolean;
  provider?: string;
  code?: string;
  url?: string;
  authUrl?: string;
  callbackUrl?: string;
  oauthConfigured?: boolean;
  setupRequired?: boolean;
  error?: string;
  output?: string;
  done?: boolean;
  web?: boolean;
  login?: string;
}

export function SetupSteps({
  repos, githubRepos,
}: {
  repos: Repo[];
  githubRepos: GithubRepo[];
}) {
  const [step, setStep] = useState(0);

  const steps = [
    { num: 1, title: "GitHub", done: githubRepos.length > 0 },
    { num: 2, title: "Repositories", done: repos.length > 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Step selector */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`flex-1 ag-card p-3 flex items-center gap-3 cursor-pointer transition-all ${
              step === i ? "ag-card-glow-blue" : ""
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${
              s.done
                ? "bg-[var(--ag-green)] text-white"
                : step === i
                  ? "bg-[var(--ag-blue)] text-white"
                  : "bg-[var(--ag-raised)] text-[var(--ag-text-4)]"
            }`}>
              {s.done ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l3 3 4.5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : s.num}
            </div>
            <div className="text-left">
              <div className={`text-[13px] font-medium ${step === i ? "text-[var(--ag-text-1)]" : "text-[var(--ag-text-3)]"}`}>{s.title}</div>
              <div className="text-[11px] text-[var(--ag-text-4)]">{s.done ? "Complete" : "Not set up"}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="ag-animate-in" key={step}>
        {step === 0 && <GitHubStep />}
        {step === 1 && <RepoStep repos={repos} githubRepos={githubRepos} />}
      </div>
    </div>
  );
}

/* ─── Step 1: GitHub ─── */
function GitHubStep() {
  const [auth, setAuth] = useState<AuthState>({});
  const [syncMsg, setSyncMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkStatus() {
    const status = await api("/api/github/status");
    if (status.authenticated) {
      setAuth(status);
      return;
    }
    const authMeta = await api("/api/github/auth");
    setAuth({ ...status, ...authMeta });
  }
  async function startLogin() {
    setBusy(true);
    const loginWindow = window.open("", "_blank");
    let openedLoginUrl = false;
    try {
      const result = await api("/api/github/auth", { method: "POST" });
      const url = result.authUrl ?? result.url;
      if (url) {
        openedLoginUrl = true;
        if (loginWindow) {
          loginWindow.location.href = url;
        } else {
          window.location.href = url;
        }
        setAuth(result);
        return;
      }
      loginWindow?.close();
      setAuth(result);
      if (result.authenticated) await syncRepos();
    }
    finally {
      if (!openedLoginUrl) loginWindow?.close();
      setBusy(false);
    }
  }
  async function refreshLogin() {
    const result = await api("/api/github/auth");
    setAuth((c) => ({ ...c, ...result }));
    if (result.done) await checkStatus();
  }
  async function syncRepos() {
    setBusy(true);
    try {
      const result = await api("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setSyncMsg(result.ok ? `Synced ${result.count} repositories` : result.error ?? "Failed");
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusy(false); }
  }
  async function disconnectGitHub() {
    setBusy(true);
    try {
      await api("/api/github/auth", { method: "DELETE" });
      await checkStatus();
    } finally { setBusy(false); }
  }

  useEffect(() => { checkStatus(); }, []);

  return (
    <div className="ag-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--ag-text-1)]">GitHub Connection</h2>
          <p className="text-[13px] text-[var(--ag-text-3)] mt-1">
            {auth.authenticated ? `Connected${auth.login ? ` as ${auth.login}` : ""}. You can sync your repositories.` : "Sign in with GitHub in your browser to pull your repos."}
          </p>
        </div>
        <span className={`ag-badge ${auth.authenticated ? "ag-badge-success" : "ag-badge-neutral"}`}>
          {auth.authenticated ? "Connected" : "Not connected"}
        </span>
      </div>

      {!auth.authenticated && !auth.code && (
        <>
          {auth.setupRequired && (
            <div className="p-4 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">GitHub browser SSO needs one-time setup</div>
              <p className="text-[12px] text-[var(--ag-text-4)] mt-1">Configure the GitHub OAuth app once, then this button opens GitHub in the browser and stores the returned token locally.</p>
              <div className="mt-3 space-y-2 text-[12px] text-[var(--ag-text-3)]">
                <div>Callback URL: <code className="px-2 py-1 rounded bg-[var(--ag-raised)] font-mono text-[var(--ag-text-1)]">{auth.callbackUrl ?? "/api/github/callback"}</code></div>
                <div>
                  Required env: <code className="px-2 py-1 rounded bg-[var(--ag-raised)] font-mono text-[var(--ag-text-1)]">GITHUB_CLIENT_ID</code>{" "}
                  <code className="px-2 py-1 rounded bg-[var(--ag-raised)] font-mono text-[var(--ag-text-1)]">GITHUB_CLIENT_SECRET</code>
                </div>
              </div>
              {auth.error && <p className="text-[12px] text-[var(--ag-text-4)] mt-3">{auth.error}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="ag-btn ag-btn-primary" disabled={busy || auth.setupRequired} onClick={startLogin}>
              Sign in with GitHub in browser
            </button>
            <button className="ag-btn ag-btn-ghost" disabled={busy} onClick={checkStatus}>Recheck</button>
          </div>
          {auth.error && !auth.setupRequired && <div className="ag-message ag-message-error">{auth.error}</div>}
        </>
      )}

      {auth.code && (
        <div className="p-4 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
          <p className="text-[13px] text-[var(--ag-text-3)]">Open GitHub and enter this code:</p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <code className="px-4 py-2 rounded-md bg-[var(--ag-raised)] border border-[var(--ag-border)] font-mono text-[18px] text-[var(--ag-text-1)] tracking-[0.2em]">{auth.code}</code>
            <a className="ag-btn ag-btn-ghost" href={auth.url ?? "https://github.com/login/device"} target="_blank" rel="noreferrer">Open GitHub</a>
            <button className="ag-btn ag-btn-primary" onClick={refreshLogin}>I approved it</button>
          </div>
        </div>
      )}

      {auth.authenticated && (
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Sync Repositories</div>
            <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5">Pull your GitHub repos so you can clone and govern them.</p>
          </div>
          <div className="flex gap-2">
            <button className="ag-btn ag-btn-ghost" disabled={busy} onClick={disconnectGitHub}>Disconnect</button>
            <button className="ag-btn ag-btn-primary" disabled={busy} onClick={syncRepos}>
              {busy ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>
      )}

      {syncMsg && <div className="ag-message ag-message-success">{syncMsg}</div>}
    </div>
  );
}

/* ─── Step 2: Repos ─── */
function RepoStep({ repos, githubRepos }: { repos: Repo[]; githubRepos: GithubRepo[] }) {
  const [query, setQuery] = useState("");
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showLocal, setShowLocal] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localOwner, setLocalOwner] = useState("local");
  const [localRepo, setLocalRepo] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [localBranch, setLocalBranch] = useState("main");

  const managed = useMemo(() => new Set(repos.map((r) => r.github)), [repos]);
  const filtered = githubRepos.filter((r) => r.nameWithOwner.toLowerCase().includes(query.toLowerCase()));

  async function cloneRepo(repo: GithubRepo) {
    setBusyRepo(repo.nameWithOwner);
    setMessage(null);
    try {
      const result = await api("/api/repos/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameWithOwner: repo.nameWithOwner, defaultBranch: repo.defaultBranch }),
      });
      setMessage({ text: result.ok ? `Cloned ${repo.nameWithOwner}` : result.error, ok: result.ok });
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusyRepo(null); }
  }

  async function linkLocal() {
    setBusyRepo("local");
    setMessage(null);
    try {
      const result = await api("/api/repos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: localName, owner: localOwner, repo: localRepo || localName, path: localPath, branch: localBranch }),
      });
      setMessage({ text: result.ok ? `Linked ${localName}` : result.error, ok: result.ok });
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusyRepo(null); }
  }

  return (
    <div className="space-y-5">
      {message && <div className={`ag-message ${message.ok ? "ag-message-success" : "ag-message-error"}`}>{message.text}</div>}

      {/* Clone from GitHub */}
      <div className="ag-card p-5">
        <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">
          Available GitHub Repositories{githubRepos.length > 0 ? ` (${githubRepos.length} synced)` : ""}
        </h3>
        <p className="text-[12px] text-[var(--ag-text-4)] mt-1">
          {githubRepos.length > 0 ? `${filtered.length} matching repos shown.` : "Sync your GitHub repos first (Step 1)."}
        </p>
        {githubRepos.length > 0 && (
          <>
            <input className="ag-input mt-3" placeholder="Search repositories..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-3 space-y-1 max-h-[320px] overflow-y-auto">
              {filtered.map((repo) => {
                const linked = managed.has(repo.nameWithOwner);
                return (
                  <div key={repo.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-[var(--ag-raised)] transition-colors">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[var(--ag-text-1)] truncate">{repo.nameWithOwner}</div>
                      <div className="text-[11px] text-[var(--ag-text-4)] truncate">{repo.description || "No description"}</div>
                    </div>
                    <button
                      className={`ag-btn ag-btn-sm flex-shrink-0 ${linked ? "ag-btn-ghost" : "ag-btn-primary"}`}
                      disabled={linked || busyRepo === repo.nameWithOwner}
                      onClick={() => cloneRepo(repo)}
                    >
                      {linked ? "Linked" : busyRepo === repo.nameWithOwner ? "..." : "Clone"}
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="p-3 text-[12px] text-[var(--ag-text-4)]">No matches.</p>}
            </div>
          </>
        )}
      </div>

      {/* Current repos */}
      {repos.length > 0 && (
        <div className="ag-card p-5">
          <div className="ag-section-label mb-1">Linked Repositories ({repos.length} managed)</div>
          <p className="mb-3 text-[12px] text-[var(--ag-text-4)]">These repos are already connected to Governor. They are separate from the synced GitHub list above.</p>
          <div className="space-y-1.5">
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
                <div>
                  <div className="text-[13px] font-medium text-[var(--ag-text-1)]">{r.name}</div>
                  <div className="text-[11px] text-[var(--ag-text-4)]">{r.github}</div>
                </div>
                <span className="ag-badge ag-badge-success">Managed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link local */}
      <div className="ag-card p-5">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setShowLocal(!showLocal)}
        >
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Link a Local Repo</h3>
            <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5">Already have a repo cloned on this machine.</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-transform ${showLocal ? "rotate-180" : ""}`}>
            <path d="M3.5 5.5l3.5 3.5 3.5-3.5" stroke="var(--ag-text-4)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
        {showLocal && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 ag-animate-in">
            <div>
              <label className="ag-label">Name</label>
              <input className="ag-input" placeholder="e.g. api-server" value={localName} onChange={(e) => setLocalName(e.target.value)} />
            </div>
            <div>
              <label className="ag-label">Owner</label>
              <input className="ag-input" placeholder="GitHub owner or 'local'" value={localOwner} onChange={(e) => setLocalOwner(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="ag-label">Local path</label>
              <input className="ag-input" placeholder="/absolute/path/to/repo" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
            </div>
            <div>
              <label className="ag-label">Default branch</label>
              <input className="ag-input" placeholder="main" value={localBranch} onChange={(e) => setLocalBranch(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button
                className="ag-btn ag-btn-primary w-full"
                disabled={busyRepo === "local" || !localName || !localOwner || !localPath}
                onClick={linkLocal}
              >
                {busyRepo === "local" ? "Linking..." : "Link Repo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

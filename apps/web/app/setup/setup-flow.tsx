"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Repo = { id: number; name: string; github: string };
type GithubRepo = { id: number; nameWithOwner: string; description: string; visibility: string; defaultBranch: string; url: string };
type Runtime = { id: string; label: string; type: string; enabled: boolean; detected: boolean; detectedCommand: string | null; command: string | null; capabilities: string[] };
type LocalTool = { id: string; label: string; kind: string; runnable: boolean; detected: boolean; detectedBy: string | null; capabilities: string[] };

async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return { ok: false, error: "Empty response" };
  try { return JSON.parse(text); } catch { return { ok: false, error: text }; }
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
  pending?: boolean;
  done?: boolean;
  web?: boolean;
  login?: string;
}

export function SetupFlow({
  repos, githubRepos, runtimes, localTools,
}: {
  repos: Repo[];
  githubRepos: GithubRepo[];
  runtimes: Runtime[];
  localTools: LocalTool[];
}) {
  const runnableRuntimes = runtimes.filter((runtime) => runtime.enabled);
  const initialStep = githubRepos.length === 0 ? 0 : repos.length === 0 ? 1 : runnableRuntimes.length === 0 ? 2 : 1;
  const [activeStep, setActiveStep] = useState(initialStep);

  const steps = [
    { title: "GitHub", description: "Sign in with GitHub", done: githubRepos.length > 0 },
    { title: "Repository", description: `${githubRepos.length} synced, ${repos.length} managed`, done: repos.length > 0 },
    { title: "Runtimes", description: "Check local workers", done: runnableRuntimes.length > 0 },
  ];
  const completeCount = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-6">
      <div className="ag-card ag-card-glow-blue p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="ag-section-label mb-2">First run</div>
            <h1 className="text-[22px] font-semibold leading-tight text-[var(--ag-heading)]">Set up your AI runtime control plane</h1>
            <p className="mt-2 max-w-[760px] text-sm leading-6 text-[var(--ag-muted)]">
              Connect GitHub, pick a repository, and confirm at least one runtime. After that, Governor can route work, keep approvals visible, and prepare PRs.
            </p>
          </div>
          <div className="min-w-[180px] rounded-lg border border-[var(--ag-line)] bg-[var(--ag-surface)] p-4">
            <div className="text-xs text-[var(--ag-muted)]">Setup progress</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--ag-heading)]">{completeCount}/3</div>
            <div className="mt-3 h-2 rounded-full bg-[var(--ag-bg)]">
              <div className="h-2 rounded-full bg-[var(--ag-primary)] transition-all" style={{ width: `${(completeCount / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`ag-card p-3 text-left cursor-pointer transition-colors ${
              activeStep === i ? "border-[var(--ag-primary)] bg-[color-mix(in_srgb,var(--ag-primary)_8%,var(--ag-panel))]" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                step.done ? "bg-[var(--ag-green)] text-[var(--ag-bg)]" : activeStep === i ? "bg-[var(--ag-primary)] text-[var(--ag-bg)]" : "bg-[var(--ag-panel-2)] text-[var(--ag-muted)]"
              }`}>
                {step.done ? "OK" : i + 1}
              </div>
              <div>
                <div className={`text-sm font-medium ${activeStep === i ? "text-[var(--ag-heading)]" : "text-[var(--ag-muted)]"}`}>{step.title}</div>
                <div className="text-xs text-[var(--ag-muted)] hidden sm:block">{step.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {activeStep === 0 && <GitHubStep />}
      {activeStep === 1 && <RepoStep repos={repos} githubRepos={githubRepos} />}
      {activeStep === 2 && <AgentStep runtimes={runtimes} localTools={localTools} />}

      {completeCount === steps.length && (
        <div className="ag-card border-[var(--ag-green)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--ag-heading)]">Governor is ready</div>
              <p className="mt-1 text-sm text-[var(--ag-muted)]">You can create a task, route it to a runtime, and review approvals from the dashboard.</p>
            </div>
            <a className="ag-btn ag-btn-primary" href="/">Go to dashboard</a>
          </div>
        </div>
      )}
    </div>
  );
}

function GitHubStep() {
  const [auth, setAuth] = useState<AuthState>({});
  const [syncResult, setSyncResult] = useState("");
  const [busy, setBusy] = useState(false);
  const autoSynced = useRef(false);

  async function checkStatus() {
    const res = await fetch("/api/github/status", { cache: "no-store" });
    const status = await readJson(res);
    if (status.authenticated) {
      setAuth(status);
      return;
    }
    const authRes = await fetch("/api/github/auth", { cache: "no-store" });
    const authMeta = await readJson(authRes);
    setAuth({ ...status, ...authMeta });
  }

  async function startLogin() {
    setBusy(true);
    try {
      const res = await fetch("/api/github/auth", { method: "POST" });
      const result = await readJson(res);
      if (result.authUrl) {
        window.location.href = result.authUrl;
        return;
      }
      setAuth(result);
    } finally { setBusy(false); }
  }

  async function refreshLogin() {
    const res = await fetch("/api/github/auth", { cache: "no-store" });
    const login = await readJson(res);
    setAuth((c) => ({ ...c, ...login }));
    if (login.done) await checkStatus();
  }

  async function syncRepos() {
    setBusy(true);
    try {
      const res = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await readJson(res);
      setSyncResult(result.ok ? `Synced ${result.count} repositories` : result.error ?? "Sync failed");
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusy(false); }
  }

  async function disconnectGitHub() {
    setBusy(true);
    try {
      await fetch("/api/github/auth", { method: "DELETE" });
      await checkStatus();
    } finally { setBusy(false); }
  }

  useEffect(() => {
    async function initialize() {
      await checkStatus();
      const params = new URLSearchParams(window.location.search);
      if (params.get("github") === "connected" && !autoSynced.current) {
        autoSynced.current = true;
        window.history.replaceState(null, "", window.location.pathname);
        await syncRepos();
      }
    }
    initialize();
  }, []);

  return (
    <div className="ag-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--ag-heading)]">GitHub Authentication</h2>
          <p className="mt-1 text-sm text-[var(--ag-muted)]">
            {auth.authenticated ? `Connected to GitHub${auth.login ? ` as ${auth.login}` : ""}.` : "Sign in with GitHub in your browser to sync your repositories."}
          </p>
        </div>
        <div className={`ag-badge ${auth.authenticated ? "ag-badge-success" : "ag-badge-muted"}`}>
          {auth.authenticated ? "Connected" : "Not connected"}
        </div>
      </div>

      {!auth.authenticated && !auth.code && (
        <>
          {auth.setupRequired && <GitHubSsoSetupNotice auth={auth} />}
          <div className="flex gap-2">
            <button className="ag-btn ag-btn-primary" disabled={busy || auth.setupRequired} onClick={startLogin}>
              {busy ? "Starting..." : "Sign in with GitHub in browser"}
            </button>
            <button className="ag-btn ag-btn-secondary" disabled={busy} onClick={checkStatus}>Check again</button>
          </div>
        </>
      )}

      {auth.code && (
        <div className="rounded-lg bg-[var(--ag-surface)] border border-[var(--ag-line)] p-4">
          <p className="text-sm text-[var(--ag-soft)]">Open GitHub and enter this code:</p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <code className="rounded-md bg-[var(--ag-bg)] px-4 py-2 font-mono text-lg text-[var(--ag-heading)] tracking-widest">{auth.code}</code>
            <a className="ag-btn ag-btn-secondary" href={auth.url ?? "https://github.com/login/device"} target="_blank" rel="noreferrer">Open GitHub</a>
            <button className="ag-btn ag-btn-primary" onClick={refreshLogin}>I approved it</button>
          </div>
        </div>
      )}

      {auth.authenticated && (
        <div className="flex flex-col gap-4 rounded-lg bg-[var(--ag-surface)] border border-[var(--ag-line)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--ag-heading)]">Sync repositories</div>
            <p className="text-xs text-[var(--ag-muted)]">Pull your GitHub repos into Governor so the next step can clone one.</p>
          </div>
          <div className="flex gap-2">
            <button className="ag-btn ag-btn-secondary" disabled={busy} onClick={disconnectGitHub}>Disconnect</button>
            <button className="ag-btn ag-btn-primary" disabled={busy} onClick={syncRepos}>
              {busy ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>
      )}

      {syncResult && <div className="text-sm text-[var(--ag-green)]">{syncResult}</div>}
    </div>
  );
}

function GitHubSsoSetupNotice({ auth }: { auth: AuthState }) {
  return (
    <div className="rounded-lg bg-[color-mix(in_srgb,var(--ag-primary)_8%,var(--ag-surface))] border border-[var(--ag-line)] p-4">
      <div className="text-sm font-semibold text-[var(--ag-heading)]">GitHub browser SSO needs one-time setup</div>
      <p className="mt-1 text-sm text-[var(--ag-muted)]">
        Create a GitHub OAuth App, add this callback URL, then set the env vars and restart the app.
      </p>
      <div className="mt-3 space-y-2 text-xs text-[var(--ag-soft)]">
        <div>
          Callback URL:
          <code className="ml-2 rounded bg-[var(--ag-bg)] px-2 py-1 font-mono text-[var(--ag-heading)]">{auth.callbackUrl ?? "/api/github/callback"}</code>
        </div>
        <div>
          Required env:
          <code className="ml-2 rounded bg-[var(--ag-bg)] px-2 py-1 font-mono text-[var(--ag-heading)]">GITHUB_CLIENT_ID</code>
          <code className="ml-2 rounded bg-[var(--ag-bg)] px-2 py-1 font-mono text-[var(--ag-heading)]">GITHUB_CLIENT_SECRET</code>
        </div>
      </div>
      {auth.error && <p className="mt-3 text-xs text-[var(--ag-muted)]">{auth.error}</p>}
    </div>
  );
}

function RepoStep({ repos, githubRepos }: { repos: Repo[]; githubRepos: GithubRepo[] }) {
  const [query, setQuery] = useState("");
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Local repo linking
  const [localName, setLocalName] = useState("");
  const [localOwner, setLocalOwner] = useState("local");
  const [localRepo, setLocalRepo] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [localBranch, setLocalBranch] = useState("main");

  const managedNames = useMemo(() => new Set(repos.map((r) => r.github)), [repos]);
  const filtered = githubRepos.filter((r) => r.nameWithOwner.toLowerCase().includes(query.toLowerCase()));

  async function cloneRepo(repo: GithubRepo) {
    setBusyRepo(repo.nameWithOwner);
    setMessage(null);
    try {
      const res = await fetch("/api/repos/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameWithOwner: repo.nameWithOwner, defaultBranch: repo.defaultBranch }),
      });
      const result = await readJson(res);
      setMessage({ text: result.ok ? `Cloned ${repo.nameWithOwner}` : result.error, ok: result.ok });
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusyRepo(null); }
  }

  async function linkLocal() {
    setBusyRepo("local");
    setMessage(null);
    try {
      const res = await fetch("/api/repos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: localName, owner: localOwner, repo: localRepo || localName, path: localPath, branch: localBranch }),
      });
      const result = await readJson(res);
      setMessage({ text: result.ok ? `Linked ${localName}` : result.error, ok: result.ok });
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusyRepo(null); }
  }

  return (
    <div className="space-y-5">
      {/* Clone from GitHub */}
      <div className="ag-card p-5">
        <h2 className="text-base font-semibold text-[var(--ag-heading)]">
          Available GitHub Repositories{githubRepos.length > 0 ? ` (${githubRepos.length} synced)` : ""}
        </h2>
        <p className="mt-1 text-xs text-[var(--ag-muted)]">
          {githubRepos.length > 0
            ? `${filtered.length} matching repos shown. Select one to clone and govern.`
            : "No repos synced yet. Go to the GitHub step to sync your repos first."}
        </p>

        {message && (
          <div className={`mt-3 rounded-md px-3 py-2 text-xs font-medium ${message.ok ? "bg-[color-mix(in_srgb,var(--ag-green)_12%,transparent)] text-[var(--ag-green)]" : "bg-[color-mix(in_srgb,var(--ag-coral)_12%,transparent)] text-[var(--ag-coral)]"}`}>
            {message.text}
          </div>
        )}

        {githubRepos.length > 0 && (
          <>
            <input
              className="ag-input mt-3"
              placeholder="Filter repositories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-3 space-y-1.5 max-h-[360px] overflow-y-auto">
              {filtered.map((repo) => {
                const linked = managedNames.has(repo.nameWithOwner);
                return (
                  <div key={repo.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--ag-surface)] border border-[var(--ag-line)] px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--ag-heading)] truncate">{repo.nameWithOwner}</div>
                      <div className="text-xs text-[var(--ag-muted)] truncate">{repo.description || "No description"}</div>
                    </div>
                    <button
                      className={`ag-btn ag-btn-sm flex-shrink-0 ${linked ? "ag-btn-secondary" : "ag-btn-primary"}`}
                      disabled={linked || busyRepo === repo.nameWithOwner}
                      onClick={() => cloneRepo(repo)}
                    >
                      {linked ? "Linked" : busyRepo === repo.nameWithOwner ? "Cloning..." : "Clone"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Managed repos */}
      {repos.length > 0 && (
        <div className="ag-card p-5">
          <h2 className="text-base font-semibold text-[var(--ag-heading)]">Linked Repositories ({repos.length} managed)</h2>
          <p className="mt-1 text-xs text-[var(--ag-muted)]">These repos are already connected to Governor. They are separate from the synced GitHub repository list above.</p>
          <div className="mt-3 space-y-2">
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-[var(--ag-surface)] border border-[var(--ag-line)] px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-[var(--ag-heading)]">{r.name}</div>
                  <div className="text-xs text-[var(--ag-muted)]">{r.github}</div>
                </div>
                <span className="ag-badge ag-badge-success">Managed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link local repo */}
      <div className="ag-card p-5">
        <h2 className="text-base font-semibold text-[var(--ag-heading)]">Link a Local Repo</h2>
        <p className="mt-1 text-xs text-[var(--ag-muted)]">Already have a repo cloned on this machine? Link it directly.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1">Name</label>
            <input className="ag-input" placeholder="e.g. api-server" value={localName} onChange={(e) => setLocalName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1">Owner</label>
            <input className="ag-input" placeholder="GitHub owner or 'local'" value={localOwner} onChange={(e) => setLocalOwner(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1">Local path</label>
            <input className="ag-input" placeholder="/absolute/path/to/repo" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1">Default branch</label>
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
      </div>
    </div>
  );
}

function AgentStep({ runtimes, localTools }: { runtimes: Runtime[]; localTools: LocalTool[] }) {
  const runnableRuntimes = runtimes.filter((r) => r.enabled);
  const detectedTools = localTools.filter((t) => t.detected);

  return (
    <div className="space-y-5">
      {/* Configured runtimes */}
      <div className="ag-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--ag-heading)]">Runtime Registry</h2>
            <p className="mt-1 text-xs text-[var(--ag-muted)]">
              These are the only runtimes Governor can route prompts to today. {runnableRuntimes.length}/{runtimes.length} runnable.
            </p>
          </div>
          <button className="ag-btn ag-btn-sm ag-btn-secondary" onClick={() => window.location.reload()}>Rescan</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {runtimes.map((r) => (
            <div key={r.id} className={`rounded-lg border px-4 py-3 ${r.enabled ? "border-[var(--ag-green)] bg-[color-mix(in_srgb,var(--ag-green)_5%,var(--ag-surface))]" : "border-[var(--ag-line)] bg-[var(--ag-surface)]"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--ag-heading)]">{r.label}</span>
                <span className={`ag-badge ${r.enabled ? "ag-badge-success" : "ag-badge-muted"}`}>
                  {r.detected ? "Detected" : r.enabled ? "Configured" : "Missing"}
                </span>
              </div>
              {r.command && <div className="mt-1 font-mono text-xs text-[var(--ag-muted)]">{r.command}</div>}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.capabilities.map((c) => (
                  <span key={c} className="rounded bg-[var(--ag-panel-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ag-muted)] uppercase">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detected local tools */}
      <div className="ag-card p-5">
        <h2 className="text-base font-semibold text-[var(--ag-heading)]">Detected Local Tools</h2>
        <p className="mt-1 text-xs text-[var(--ag-muted)]">
          Local tools found on this machine. They are not prompt targets until a CLI or bridge adapter is configured.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {localTools.map((t) => (
            <div key={t.id} className={`rounded-lg border px-3 py-2.5 ${t.detected ? "border-[var(--ag-line-strong)] bg-[var(--ag-surface)]" : "border-[var(--ag-line)] bg-[var(--ag-surface)] opacity-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--ag-heading)]">{t.label}</span>
                <span className={`h-2 w-2 rounded-full ${t.detected ? "bg-[var(--ag-green)]" : "bg-[var(--ag-line)]"}`} />
              </div>
              <div className="mt-1 text-xs text-[var(--ag-muted)]">
                {t.detected && t.runnable ? "Can become a runtime adapter" : t.detected ? "Detected only — needs bridge" : "Not found locally"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

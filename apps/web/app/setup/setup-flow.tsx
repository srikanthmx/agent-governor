"use client";

import { useEffect, useMemo, useState } from "react";

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
  code?: string;
  url?: string;
  output?: string;
  pending?: boolean;
  done?: boolean;
}

export function SetupFlow({
  repos, githubRepos, runtimes, localTools,
}: {
  repos: Repo[];
  githubRepos: GithubRepo[];
  runtimes: Runtime[];
  localTools: LocalTool[];
}) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { title: "GitHub", description: "Authenticate with GitHub CLI" },
    { title: "Repositories", description: "Clone or link repos to govern" },
    { title: "Agents", description: "Detect local AI coding tools" },
  ];

  return (
    <div className="space-y-6">
      {/* Step tabs */}
      <div className="flex gap-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`flex-1 ag-card p-3 text-left cursor-pointer transition-colors ${
              activeStep === i ? "border-[var(--ag-primary)] bg-[color-mix(in_srgb,var(--ag-primary)_8%,var(--ag-panel))]" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                activeStep === i ? "bg-[var(--ag-primary)] text-[var(--ag-bg)]" : "bg-[var(--ag-panel-2)] text-[var(--ag-muted)]"
              }`}>
                {i + 1}
              </div>
              <div>
                <div className={`text-sm font-medium ${activeStep === i ? "text-[var(--ag-heading)]" : "text-[var(--ag-muted)]"}`}>{step.title}</div>
                <div className="text-xs text-[var(--ag-muted)] hidden sm:block">{step.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Step content */}
      {activeStep === 0 && <GitHubStep />}
      {activeStep === 1 && <RepoStep repos={repos} githubRepos={githubRepos} />}
      {activeStep === 2 && <AgentStep runtimes={runtimes} localTools={localTools} />}
    </div>
  );
}

function GitHubStep() {
  const [auth, setAuth] = useState<AuthState>({});
  const [syncResult, setSyncResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkStatus() {
    const res = await fetch("/api/github/status", { cache: "no-store" });
    setAuth(await readJson(res));
  }

  async function startLogin() {
    setBusy(true);
    try {
      const res = await fetch("/api/github/auth", { method: "POST" });
      setAuth(await readJson(res));
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
      const res = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 100 }) });
      const result = await readJson(res);
      setSyncResult(result.ok ? `Synced ${result.count} repositories` : result.error ?? "Sync failed");
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusy(false); }
  }

  useEffect(() => { checkStatus(); }, []);

  return (
    <div className="ag-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--ag-heading)]">GitHub Authentication</h2>
          <p className="mt-1 text-sm text-[var(--ag-muted)]">
            {auth.authenticated ? "Connected to GitHub." : "Sign in with the GitHub CLI to sync your repositories."}
          </p>
        </div>
        <div className={`ag-badge ${auth.authenticated ? "ag-badge-success" : "ag-badge-muted"}`}>
          {auth.authenticated ? "Connected" : "Not connected"}
        </div>
      </div>

      {!auth.authenticated && !auth.code && (
        <div className="flex gap-2">
          <button className="ag-btn ag-btn-primary" disabled={busy} onClick={startLogin}>
            {busy ? "Starting..." : "Sign in with GitHub"}
          </button>
          <button className="ag-btn ag-btn-secondary" disabled={busy} onClick={checkStatus}>Check status</button>
        </div>
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
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--ag-surface)] border border-[var(--ag-line)] p-4">
          <div>
            <div className="text-sm font-medium text-[var(--ag-heading)]">Sync repositories</div>
            <p className="text-xs text-[var(--ag-muted)]">Pull your GitHub repos into Agent Governor so you can clone and govern them.</p>
          </div>
          <button className="ag-btn ag-btn-primary" disabled={busy} onClick={syncRepos}>
            {busy ? "Syncing..." : "Sync"}
          </button>
        </div>
      )}

      {syncResult && <div className="text-sm text-[var(--ag-green)]">{syncResult}</div>}
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
  const filtered = githubRepos.filter((r) => r.nameWithOwner.toLowerCase().includes(query.toLowerCase())).slice(0, 10);

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
      {/* Managed repos */}
      {repos.length > 0 && (
        <div className="ag-card p-5">
          <h2 className="text-base font-semibold text-[var(--ag-heading)]">Managed Repositories</h2>
          <div className="mt-3 space-y-2">
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-[var(--ag-surface)] border border-[var(--ag-line)] px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-[var(--ag-heading)]">{r.name}</div>
                  <div className="text-xs text-[var(--ag-muted)]">{r.github}</div>
                </div>
                <span className="ag-badge ag-badge-success">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clone from GitHub */}
      <div className="ag-card p-5">
        <h2 className="text-base font-semibold text-[var(--ag-heading)]">Clone from GitHub</h2>
        <p className="mt-1 text-xs text-[var(--ag-muted)]">
          {githubRepos.length > 0
            ? `${githubRepos.length} repos synced. Select one to clone and govern.`
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
            <h2 className="text-base font-semibold text-[var(--ag-heading)]">Runtime Agents</h2>
            <p className="mt-1 text-xs text-[var(--ag-muted)]">
              These are the only agents Agent Governor can route prompts to today. {runnableRuntimes.length}/{runtimes.length} runnable.
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

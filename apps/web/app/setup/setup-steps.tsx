"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; name: string; github: string };
type GithubRepo = { id: number; nameWithOwner: string; description: string; visibility: string; defaultBranch: string; url: string };
type Runtime = { id: string; label: string; type: string; enabled: boolean; detected: boolean; detectedCommand: string | null; command: string | null; capabilities: string[] };
type LocalTool = { id: string; label: string; kind: string; runnable: boolean; detected: boolean; detectedBy: string | null; capabilities: string[]; promptRunnable?: boolean; status?: string; reason?: string; installCommand?: string; installUrl?: string; notes?: string };

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  return text ? JSON.parse(text) : { ok: false, error: "Empty response" };
}

interface AuthState {
  authenticated?: boolean;
  code?: string;
  url?: string;
  output?: string;
  done?: boolean;
}

export function SetupSteps({
  repos, githubRepos, runtimes, localTools,
}: {
  repos: Repo[];
  githubRepos: GithubRepo[];
  runtimes: Runtime[];
  localTools: LocalTool[];
}) {
  const [step, setStep] = useState(0);

  const steps = [
    { num: 1, title: "GitHub", done: githubRepos.length > 0 },
    { num: 2, title: "Repositories", done: repos.length > 0 },
    { num: 3, title: "Agents", done: runtimes.some((r) => r.enabled) },
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
        {step === 2 && <AgentStep runtimes={runtimes} localTools={localTools} />}
      </div>
    </div>
  );
}

/* ─── Step 1: GitHub ─── */
function GitHubStep() {
  const [auth, setAuth] = useState<AuthState>({});
  const [syncMsg, setSyncMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkStatus() { setAuth(await api("/api/github/status")); }
  async function startLogin() {
    setBusy(true);
    try { setAuth(await api("/api/github/auth", { method: "POST" })); }
    finally { setBusy(false); }
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
        body: JSON.stringify({ limit: 100 }),
      });
      setSyncMsg(result.ok ? `Synced ${result.count} repositories` : result.error ?? "Failed");
      if (result.ok) setTimeout(() => window.location.reload(), 800);
    } finally { setBusy(false); }
  }

  useEffect(() => { checkStatus(); }, []);

  return (
    <div className="ag-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--ag-text-1)]">GitHub Connection</h2>
          <p className="text-[13px] text-[var(--ag-text-3)] mt-1">
            {auth.authenticated ? "Connected. You can sync your repositories." : "Sign in with the GitHub CLI to pull your repos."}
          </p>
        </div>
        <span className={`ag-badge ${auth.authenticated ? "ag-badge-success" : "ag-badge-neutral"}`}>
          {auth.authenticated ? "Connected" : "Not connected"}
        </span>
      </div>

      {!auth.authenticated && !auth.code && (
        <div className="flex gap-2">
          <button className="ag-btn ag-btn-primary" disabled={busy} onClick={startLogin}>
            Sign in with GitHub
          </button>
          <button className="ag-btn ag-btn-ghost" disabled={busy} onClick={checkStatus}>Recheck</button>
        </div>
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
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
          <div>
            <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Sync Repositories</div>
            <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5">Pull your GitHub repos so you can clone and govern them.</p>
          </div>
          <button className="ag-btn ag-btn-primary" disabled={busy} onClick={syncRepos}>
            {busy ? "Syncing..." : "Sync"}
          </button>
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
  const filtered = githubRepos.filter((r) => r.nameWithOwner.toLowerCase().includes(query.toLowerCase())).slice(0, 12);

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
      {/* Current repos */}
      {repos.length > 0 && (
        <div className="ag-card p-5">
          <div className="ag-section-label mb-3">Managed Repositories</div>
          <div className="space-y-1.5">
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
                <div>
                  <div className="text-[13px] font-medium text-[var(--ag-text-1)]">{r.name}</div>
                  <div className="text-[11px] text-[var(--ag-text-4)]">{r.github}</div>
                </div>
                <span className="ag-badge ag-badge-success">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <div className={`ag-message ${message.ok ? "ag-message-success" : "ag-message-error"}`}>{message.text}</div>}

      {/* Clone from GitHub */}
      <div className="ag-card p-5">
        <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Clone from GitHub</h3>
        <p className="text-[12px] text-[var(--ag-text-4)] mt-1">
          {githubRepos.length > 0 ? `${githubRepos.length} repos synced.` : "Sync your GitHub repos first (Step 1)."}
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

/* ─── Step 3: Agents ─── */
function AgentStep({ runtimes, localTools }: { runtimes: Runtime[]; localTools: LocalTool[] }) {
  const runnableRuntimes = runtimes.filter((r) => r.enabled);
  return (
    <div className="space-y-5">
      <div className="ag-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Runtime Agents</h3>
            <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5">
              Only these agents can execute prompts today. {runnableRuntimes.length}/{runtimes.length} runnable.
            </p>
          </div>
          <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => window.location.reload()}>
            Rescan
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {runtimes.map((r) => (
            <div
              key={r.id}
              className={`p-3 rounded-lg border transition-all ${
                r.enabled
                  ? "border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.03)]"
                  : "border-[var(--ag-border)] bg-[var(--ag-bg)]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium text-[var(--ag-text-1)]">{r.label}</span>
                <span className={`ag-badge ag-badge-sm ${r.detected ? "ag-badge-success" : r.enabled ? "ag-badge-active" : "ag-badge-neutral"}`}>
                  {r.detected ? "Detected" : r.enabled ? "Configured" : "Missing"}
                </span>
              </div>
              {r.command && (
                <div className="font-mono text-[11px] text-[var(--ag-text-4)] mt-1 truncate">{r.command}</div>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {r.capabilities.map((c) => (
                  <span key={c} className="text-[10px] font-medium text-[var(--ag-text-4)] uppercase tracking-wider bg-[var(--ag-raised)] px-1.5 py-0.5 rounded">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ag-card p-5">
        <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Local Tools</h3>
        <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5 mb-4">
          A tool appears in task flows only after this check proves it has a prompt-capable CLI or bridge.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {localTools.map((t) => (
            <div key={t.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--ag-border)] ${t.detected ? "" : "opacity-40"}`}>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[var(--ag-text-1)] truncate">{t.label}</div>
                <div className="text-[10px] text-[var(--ag-text-4)] truncate">{t.reason ?? t.kind}</div>
                {!t.promptRunnable && t.installCommand && (
                  <code className="mt-1 block truncate text-[10px] text-[var(--ag-text-3)]">{t.installCommand}</code>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {t.installUrl && (
                  <a className="text-[11px] text-[var(--ag-blue)] hover:underline" href={t.installUrl} target="_blank" rel="noreferrer">Install</a>
                )}
                <span className={`ag-badge ag-badge-sm ${t.promptRunnable ? "ag-badge-success" : t.detected ? "ag-badge-waiting" : "ag-badge-neutral"}`}>
                  {t.promptRunnable ? "Runnable" : t.detected ? "Bridge needed" : "Missing CLI"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

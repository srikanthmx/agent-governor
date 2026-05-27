"use client";

import { useEffect, useMemo, useState } from "react";

type GithubRepo = {
  id: number;
  nameWithOwner: string;
  description: string;
  visibility: string;
  defaultBranch: string;
  url: string;
};

type ManagedRepo = {
  id: number;
  name: string;
  github: string;
};

type RuntimeOption = {
  id: string;
  label: string;
  enabled: boolean;
  models?: string[];
  defaultModel?: string | null;
};

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return { ok: false, error: "Empty response" };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

function splitNameWithOwner(value: string) {
  const [owner = "", repo = ""] = value.split("/");
  return { owner, repo };
}

export function RepoWorkbench({ githubRepos, managedRepos }: { githubRepos: GithubRepo[]; managedRepos: ManagedRepo[] }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState("");
  const [localName, setLocalName] = useState("");
  const [localOwner, setLocalOwner] = useState("local");
  const [localRepo, setLocalRepo] = useState("");
  const [localBranch, setLocalBranch] = useState("main");

  const managedGithubNames = useMemo(() => new Set(managedRepos.map((repo) => repo.github)), [managedRepos]);
  const filtered = githubRepos.filter((repo) => repo.nameWithOwner.toLowerCase().includes(query.toLowerCase())).slice(0, 12);

  async function cloneRepo(repo: GithubRepo) {
    setBusyRepo(repo.nameWithOwner);
    setMessage("");
    try {
      const response = await fetch("/api/repos/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameWithOwner: repo.nameWithOwner, defaultBranch: repo.defaultBranch })
      });
      const result = await readJson(response);
      setMessage(result.ok ? `Registered ${repo.nameWithOwner}` : result.error);
      if (result.ok) {
        window.location.reload();
      }
    } finally {
      setBusyRepo(null);
    }
  }

  async function registerLocal() {
    setBusyRepo("local");
    setMessage("");
    try {
      const response = await fetch("/api/repos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: localName,
          owner: localOwner,
          repo: localRepo || localName,
          path: localPath,
          branch: localBranch
        })
      });
      const result = await readJson(response);
      setMessage(result.ok ? `Linked ${localName}` : result.error);
      if (result.ok) {
        window.location.reload();
      }
    } finally {
      setBusyRepo(null);
    }
  }

  return (
    <section className="ag-panel rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343727] px-4 py-3">
        <div>
          <div className="ag-kicker text-xs uppercase">[ repo intake ]</div>
          <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Repository Onboarding</h2>
          <p className="mt-1 text-xs text-[#9b9b89]">Clone from GitHub or link a repo that already exists on this machine.</p>
        </div>
        {message ? <span className="rounded border border-[#ffca58]/35 bg-[#ffca58]/10 px-2 py-1 text-xs text-[#ffe1a0]">{message}</span> : null}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <input
              className="h-9 flex-1 rounded-md border border-[#343727] bg-[#090a07] px-3 text-sm text-[#f8f1d0]"
              placeholder="Filter synced GitHub repositories"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="overflow-hidden rounded-md border border-[#343727]">
            <table className="w-full border-collapse text-sm">
              <thead className="ag-table-head text-left text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Repo</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((repo) => {
                  const linked = managedGithubNames.has(repo.nameWithOwner);
                  return (
                    <tr key={repo.id} className="ag-row border-t border-[#343727]">
                      <td className="px-3 py-2">
                        <a className="font-semibold text-[#ffca58] underline decoration-[#ffca58]/40 underline-offset-4" href={repo.url}>{repo.nameWithOwner}</a>
                        <p className="mt-1 max-w-[360px] truncate text-xs text-[#9b9b89]">{repo.description || "No description"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className={linked ? "font-mono text-xs uppercase text-[#b8ff65]" : "font-mono text-xs uppercase text-[#d6cfaa]"}>{linked ? "managed" : repo.visibility}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{repo.defaultBranch || "main"}</td>
                      <td className="px-3 py-2">
                        <button
                          className="h-8 rounded-md border border-[#6bdcff]/45 bg-[#6bdcff]/10 px-2 text-xs font-semibold text-[#b5edff] disabled:cursor-not-allowed disabled:border-[#343727] disabled:bg-[#202316] disabled:text-[#747763]"
                          disabled={linked || busyRepo === repo.nameWithOwner}
                          onClick={() => cloneRepo(repo)}
                        >
                          {linked ? "Linked" : busyRepo === repo.nameWithOwner ? "Cloning" : "Clone"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr className="border-t border-[#343727]">
                    <td className="px-3 py-6 text-[#9b9b89]" colSpan={4}>No GitHub repos match this filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-[#343727] bg-[#090a07] p-3">
          <h3 className="text-sm font-black uppercase text-[#f8f1d0]">Link Local Repo</h3>
          <div className="mt-3 grid gap-2">
            <input className="h-9 rounded-md border border-[#343727] bg-[#0c0d09] px-3 text-sm text-[#f8f1d0]" placeholder="Registry name, e.g. api-server" value={localName} onChange={(event) => setLocalName(event.target.value)} />
            <input className="h-9 rounded-md border border-[#343727] bg-[#0c0d09] px-3 text-sm text-[#f8f1d0]" placeholder="GitHub owner or local" value={localOwner} onChange={(event) => setLocalOwner(event.target.value)} />
            <input className="h-9 rounded-md border border-[#343727] bg-[#0c0d09] px-3 text-sm text-[#f8f1d0]" placeholder="Repo slug" value={localRepo} onChange={(event) => setLocalRepo(event.target.value)} />
            <input className="h-9 rounded-md border border-[#343727] bg-[#0c0d09] px-3 text-sm text-[#f8f1d0]" placeholder="/absolute/path/to/repo" value={localPath} onChange={(event) => setLocalPath(event.target.value)} />
            <input className="h-9 rounded-md border border-[#343727] bg-[#0c0d09] px-3 text-sm text-[#f8f1d0]" placeholder="Default branch" value={localBranch} onChange={(event) => setLocalBranch(event.target.value)} />
        <button className="h-9 rounded-md bg-[#ffca58] px-3 text-sm font-black text-[#11120d] disabled:cursor-not-allowed disabled:bg-[#343727] disabled:text-[#8c8d7b]" disabled={busyRepo === "local" || !localName || !localOwner || !localPath} onClick={registerLocal}>
              {busyRepo === "local" ? "Linking" : "Link Local Repo"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CreateTaskPanel({ repos, runtimes }: { repos: ManagedRepo[]; runtimes: RuntimeOption[] }) {
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [runtimeId, setRuntimeId] = useState(runtimes.find((runtime) => runtime.enabled)?.id ?? runtimes[0]?.id ?? "");
  const selectedRuntime = useMemo(() => runtimes.find((runtime) => runtime.id === runtimeId), [runtimeId, runtimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nextRuntime = runtimes.find((runtime) => runtime.id === runtimeId);
    setModel(nextRuntime?.defaultModel ?? nextRuntime?.models?.[0] ?? "");
  }, [runtimeId, runtimes]);

  async function createTask(run = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, description, runtimeId, model, run })
      });
      const result = await readJson(response);
      setMessage(result.ok ? `${run ? "Created and ran" : "Created"} ${result.taskId}` : result.error);
      if (result.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ag-panel rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="ag-kicker text-xs uppercase">[ intake ]</div>
          <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Create Task</h2>
        </div>
        {message ? <span className="text-xs text-[#ffca58]">{message}</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <select className="h-9 rounded-md border border-[#343727] bg-[#090a07] px-2 text-sm text-[#f8f1d0]" value={repo} onChange={(event) => setRepo(event.target.value)}>
          {repos.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <input className="h-9 rounded-md border border-[#343727] bg-[#090a07] px-2 text-sm text-[#f8f1d0]" placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <select className="h-9 rounded-md border border-[#343727] bg-[#090a07] px-2 text-sm text-[#f8f1d0] md:col-span-2" value={runtimeId} onChange={(event) => setRuntimeId(event.target.value)}>
          {runtimes.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.label} {runtime.enabled ? "" : "(disabled)"}</option>)}
        </select>
        {(selectedRuntime?.models?.length ?? 0) > 0 ? (
          <select className="h-9 rounded-md border border-[#343727] bg-[#090a07] px-2 text-sm text-[#f8f1d0] md:col-span-2" value={model} onChange={(event) => setModel(event.target.value)}>
            {selectedRuntime?.models?.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : null}
        <textarea className="min-h-20 rounded-md border border-[#343727] bg-[#090a07] p-2 text-sm text-[#f8f1d0] md:col-span-2" placeholder="Describe the work to govern" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button className="h-9 rounded-md border border-[var(--ag-line)] bg-[var(--ag-panel-2)] px-3 text-sm font-semibold text-[var(--ag-heading)] disabled:cursor-not-allowed disabled:bg-[#343727] disabled:text-[#8c8d7b]" disabled={busy || !repo || !title || !description} onClick={() => createTask(false)}>
          {busy ? "Creating" : "Create Task"}
        </button>
        <button className="h-9 rounded-md bg-[var(--ag-amber)] px-3 text-sm font-semibold text-[#11120d] disabled:cursor-not-allowed disabled:bg-[#343727] disabled:text-[#8c8d7b]" disabled={busy || !repo || !title || !description || !runtimeId} onClick={() => createTask(true)}>
          {busy ? "Running" : "Create & Run Requirements"}
        </button>
      </div>
    </section>
  );
}

export function RunTaskButton({ taskId, runtimes }: { taskId: number; runtimes: RuntimeOption[] }) {
  const [runtimeId, setRuntimeId] = useState(runtimes.find((runtime) => runtime.enabled)?.id ?? runtimes[0]?.id ?? "");
  const selectedRuntime = useMemo(() => runtimes.find((runtime) => runtime.id === runtimeId), [runtimeId, runtimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const nextRuntime = runtimes.find((runtime) => runtime.id === runtimeId);
    setModel(nextRuntime?.defaultModel ?? nextRuntime?.models?.[0] ?? "");
  }, [runtimeId, runtimes]);

  async function runTask() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/tasks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, runtimeId, model })
      });
      const result = await readJson(response);
      setMessage(result.ok ? "Run started" : result.error);
      if (result.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <select className="h-8 rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] px-2 text-xs text-[var(--ag-text)]" value={runtimeId} onChange={(event) => setRuntimeId(event.target.value)}>
        {runtimes.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.label} {runtime.enabled ? "" : "(disabled)"}</option>)}
      </select>
      {(selectedRuntime?.models?.length ?? 0) > 0 ? (
        <select className="h-8 rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] px-2 text-xs text-[var(--ag-text)]" value={model} onChange={(event) => setModel(event.target.value)}>
          {selectedRuntime?.models?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : null}
      <button className="h-8 rounded-md bg-[var(--ag-cyan)] px-3 text-xs font-semibold text-[#061018] disabled:opacity-50" disabled={busy || !runtimeId} onClick={runTask}>
        {busy ? "Running" : "Run next stage"}
      </button>
      {message ? <div className="text-xs text-[var(--ag-muted)]">{message}</div> : null}
    </div>
  );
}

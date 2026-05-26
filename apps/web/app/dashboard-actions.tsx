"use client";

import { useMemo, useState } from "react";

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
    <section className="rounded-md border border-zinc-800 bg-zinc-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-zinc-300">Repository Onboarding</h2>
          <p className="mt-1 text-xs text-zinc-500">Clone from GitHub or link a repo that already exists on this machine.</p>
        </div>
        {message ? <span className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300">{message}</span> : null}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <input
              className="h-9 flex-1 rounded-md border border-zinc-700 bg-black px-3 text-sm"
              placeholder="Filter synced GitHub repositories"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="overflow-hidden rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
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
                    <tr key={repo.id} className="border-t border-zinc-800">
                      <td className="px-3 py-2">
                        <a className="text-zinc-100 underline decoration-zinc-700 underline-offset-4" href={repo.url}>{repo.nameWithOwner}</a>
                        <p className="mt-1 max-w-[360px] truncate text-xs text-zinc-500">{repo.description || "No description"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className={linked ? "text-emerald-400" : "text-zinc-400"}>{linked ? "managed" : repo.visibility}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{repo.defaultBranch || "main"}</td>
                      <td className="px-3 py-2">
                        <button
                          className="h-8 rounded-md border border-zinc-700 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
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
                  <tr className="border-t border-zinc-800">
                    <td className="px-3 py-6 text-zinc-500" colSpan={4}>No GitHub repos match this filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
          <h3 className="text-sm font-semibold uppercase text-zinc-300">Link Local Repo</h3>
          <div className="mt-3 grid gap-2">
            <input className="h-9 rounded-md border border-zinc-700 bg-black px-3 text-sm" placeholder="Registry name, e.g. api-server" value={localName} onChange={(event) => setLocalName(event.target.value)} />
            <input className="h-9 rounded-md border border-zinc-700 bg-black px-3 text-sm" placeholder="GitHub owner or local" value={localOwner} onChange={(event) => setLocalOwner(event.target.value)} />
            <input className="h-9 rounded-md border border-zinc-700 bg-black px-3 text-sm" placeholder="Repo slug" value={localRepo} onChange={(event) => setLocalRepo(event.target.value)} />
            <input className="h-9 rounded-md border border-zinc-700 bg-black px-3 text-sm" placeholder="/absolute/path/to/repo" value={localPath} onChange={(event) => setLocalPath(event.target.value)} />
            <input className="h-9 rounded-md border border-zinc-700 bg-black px-3 text-sm" placeholder="Default branch" value={localBranch} onChange={(event) => setLocalBranch(event.target.value)} />
        <button className="h-9 rounded-md bg-zinc-100 px-3 text-sm text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300" disabled={busyRepo === "local" || !localName || !localOwner || !localPath} onClick={registerLocal}>
              {busyRepo === "local" ? "Linking" : "Link Local Repo"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CreateTaskPanel({ repos }: { repos: ManagedRepo[] }) {
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createTask() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, description })
      });
      const result = await readJson(response);
      setMessage(result.ok ? `Created ${result.taskId}` : result.error);
      if (result.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-zinc-300">Create Task</h2>
        {message ? <span className="text-xs text-zinc-400">{message}</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <select className="h-9 rounded-md border border-zinc-700 bg-black px-2 text-sm" value={repo} onChange={(event) => setRepo(event.target.value)}>
          {repos.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <input className="h-9 rounded-md border border-zinc-700 bg-black px-2 text-sm" placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className="min-h-20 rounded-md border border-zinc-700 bg-black p-2 text-sm md:col-span-2" placeholder="Describe the work to govern" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button className="h-9 rounded-md bg-zinc-100 px-3 text-sm text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300 md:col-span-2" disabled={busy || !repo || !title || !description} onClick={createTask}>
          {busy ? "Creating" : "Create Task"}
        </button>
      </div>
    </section>
  );
}

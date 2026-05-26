"use client";

import { useState } from "react";

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

export function GitHubRepoActionsTable({ repos }: { repos: GithubRepo[] }) {
  const [message, setMessage] = useState("");
  const [busyRepo, setBusyRepo] = useState<string | null>(null);

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

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h2 className="text-sm font-semibold uppercase text-zinc-400">GitHub Repos</h2>
        {message ? <span className="text-xs text-zinc-400">{message}</span> : null}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Repo</th>
            <th className="px-3 py-2">Visibility</th>
            <th className="px-3 py-2">Branch</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => (
            <tr key={repo.id} className="border-t border-zinc-800">
              <td className="px-3 py-2">
                <a className="text-zinc-100 underline decoration-zinc-700 underline-offset-4" href={repo.url}>{repo.nameWithOwner}</a>
              </td>
              <td className="px-3 py-2">{repo.visibility}</td>
              <td className="px-3 py-2 font-mono text-xs">{repo.defaultBranch || "main"}</td>
              <td className="max-w-[360px] truncate px-3 py-2 text-zinc-500">{repo.description || "none"}</td>
              <td className="px-3 py-2">
                <button
                  className="h-8 rounded-md border border-zinc-700 px-2 text-xs"
                  disabled={busyRepo === repo.nameWithOwner}
                  onClick={() => cloneRepo(repo)}
                >
                  {busyRepo === repo.nameWithOwner ? "Cloning" : "Clone"}
                </button>
              </td>
            </tr>
          ))}
          {repos.length === 0 ? (
            <tr className="border-t border-zinc-800">
              <td className="px-3 py-6 text-zinc-500" colSpan={5}>Authenticate GitHub and sync repos.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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
    <section className="rounded-md border border-zinc-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">New Task</h2>
      <div className="space-y-3">
        <select className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm" value={repo} onChange={(event) => setRepo(event.target.value)}>
          {repos.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <input className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className="min-h-24 w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button className="h-9 w-full rounded-md bg-zinc-100 px-3 text-sm text-zinc-950" disabled={busy || !repo || !title || !description} onClick={createTask}>
          {busy ? "Creating" : "Create Task"}
        </button>
        {message ? <p className="text-xs text-zinc-400">{message}</p> : null}
      </div>
    </section>
  );
}

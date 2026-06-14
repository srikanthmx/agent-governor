"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; name: string; github: string };
type Runtime = { id: string; label: string; enabled: boolean; models?: string[]; defaultModel?: string | null };

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return { ok: false, error: "Empty response" };
  try { return JSON.parse(text); } catch { return { ok: false, error: text }; }
}

export function CreateTaskForm({ repos, runtimes }: { repos: Repo[]; runtimes: Runtime[] }) {
  const runnableRuntimes = runtimes.filter((runtime) => runtime.enabled);
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [runtimeId, setRuntimeId] = useState(runnableRuntimes[0]?.id ?? "");
  const selectedRuntime = useMemo(() => runnableRuntimes.find((runtime) => runtime.id === runtimeId), [runtimeId, runnableRuntimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nextRuntime = runnableRuntimes.find((runtime) => runtime.id === runtimeId);
    setModel(nextRuntime?.defaultModel ?? nextRuntime?.models?.[0] ?? "");
  }, [runtimeId, runnableRuntimes]);

  async function handleCreate(run = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, description, runtimeId, model, run }),
      });
      const result = await readJson(response);
      if (result.ok) {
        setMessage({ text: `Created TASK-${result.taskId}${run ? " — running requirements" : ""}`, ok: true });
        setTitle("");
        setDescription("");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMessage({ text: result.error, ok: false });
      }
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && repo && title && description;

  return (
    <div className="ag-card p-5">
      <h2 className="text-base font-semibold text-[var(--ag-heading)]">Create Task</h2>
      <p className="mt-1 text-xs text-[var(--ag-muted)]">Pick a repo, describe the work, choose an agent.</p>

      {message && (
        <div className={`mt-3 rounded-md px-3 py-2 text-xs font-medium ${message.ok ? "bg-[color-mix(in_srgb,var(--ag-green)_12%,transparent)] text-[var(--ag-green)]" : "bg-[color-mix(in_srgb,var(--ag-coral)_12%,transparent)] text-[var(--ag-coral)]"}`}>
          {message.text}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {repos.length === 0 ? (
          <p className="text-sm text-[var(--ag-muted)]">No repos registered yet. <a href="/setup" className="text-[var(--ag-primary)] underline">Add one in Setup</a>.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1.5">Repository</label>
              <select className="ag-select" value={repo} onChange={(e) => setRepo(e.target.value)}>
                {repos.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1.5">Task title</label>
              <input className="ag-input" placeholder="e.g. Add user authentication" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1.5">Description</label>
              <textarea className="ag-textarea" placeholder="Describe what needs to be done..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1.5">Agent</label>
              <select className="ag-select" value={runtimeId} onChange={(e) => setRuntimeId(e.target.value)}>
                {runnableRuntimes.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            {(selectedRuntime?.models?.length ?? 0) > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--ag-soft)] mb-1.5">Model</label>
                <select className="ag-select" value={model} onChange={(e) => setModel(e.target.value)}>
                  {selectedRuntime?.models?.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button className="ag-btn ag-btn-secondary flex-1" disabled={!canSubmit} onClick={() => handleCreate(false)}>
                {busy ? "Creating..." : "Create"}
              </button>
              <button className="ag-btn ag-btn-primary flex-1" disabled={!canSubmit || !runtimeId} onClick={() => handleCreate(true)}>
                {busy ? "Running..." : "Create & Run"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

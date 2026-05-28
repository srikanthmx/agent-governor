"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = { id: number; name: string; github: string };
type Runtime = { id: string; label: string; enabled: boolean; models?: string[]; defaultModel?: string | null };

export function QuickCreate({ repos, runtimes }: { repos: Repo[]; runtimes: Runtime[] }) {
  const runnableRuntimes = runtimes.filter((runtime) => runtime.enabled);
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [runtimeId, setRuntimeId] = useState(runnableRuntimes[0]?.id ?? "");
  const selectedRuntime = useMemo(() => runnableRuntimes.find((runtime) => runtime.id === runtimeId), [runtimeId, runnableRuntimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const nextRuntime = runnableRuntimes.find((runtime) => runtime.id === runtimeId);
    setModel(nextRuntime?.defaultModel ?? nextRuntime?.models?.[0] ?? "");
  }, [runtimeId, runnableRuntimes]);

  async function handleCreate(run = false) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, description, runtimeId, model, run }),
      });
      const text = await res.text();
      const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
      if (result.ok) {
        setMessage({ text: `Created #${result.taskId}`, ok: true });
        setTitle("");
        setDescription("");
        setExpanded(false);
        setTimeout(() => window.location.reload(), 600);
      } else {
        setMessage({ text: result.error, ok: false });
      }
    } catch (e) {
      setMessage({ text: "Request failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && repo && title.trim();

  if (repos.length === 0) {
    return (
      <div className="ag-card p-4">
        <div className="ag-section-label mb-2">New Task</div>
        <p className="text-[12px] text-[var(--ag-text-4)]">
          Add a repository first to create tasks.
        </p>
        <a href="/setup" className="ag-btn ag-btn-ghost ag-btn-sm mt-3 w-full">Go to Setup</a>
      </div>
    );
  }

  return (
    <div className="ag-card p-4">
      <div className="ag-section-label mb-3">New Task</div>

      {message && (
        <div className={`ag-message mb-3 ${message.ok ? "ag-message-success" : "ag-message-error"}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-2.5">
        <select className="ag-select" value={repo} onChange={(e) => setRepo(e.target.value)}>
          {repos.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>

        <input
          className="ag-input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (!expanded && e.target.value) setExpanded(true); }}
        />

        {expanded && (
          <div className="space-y-2.5 ag-animate-in">
            <textarea
              className="ag-textarea"
              placeholder="Describe the task in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />

            <select className="ag-select" value={runtimeId} onChange={(e) => setRuntimeId(e.target.value)}>
              {runnableRuntimes.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>

            {(selectedRuntime?.models?.length ?? 0) > 0 && (
              <select className="ag-select" value={model} onChange={(e) => setModel(e.target.value)}>
                {selectedRuntime?.models?.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}

            <div className="flex gap-2">
              <button className="ag-btn ag-btn-ghost flex-1" disabled={!canSubmit} onClick={() => handleCreate(false)}>
                Create
              </button>
              <button className="ag-btn ag-btn-primary flex-1" disabled={!canSubmit} onClick={() => handleCreate(true)}>
                Create & Run
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

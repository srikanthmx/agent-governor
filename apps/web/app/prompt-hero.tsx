"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Repo = { id: number; name: string; github: string };
type Runtime = { id: string; label: string; enabled: boolean; promptSelectable?: boolean; models?: string[]; defaultModel?: string | null; executionMode?: "headless" | "interactive"; marketSummary?: string | null };

export function PromptHero({ repos, runtimes }: { repos: Repo[]; runtimes: Runtime[] }) {
  const selectableRuntimes = useMemo(() => runtimes.filter((runtime) => runtime.promptSelectable ?? runtime.enabled), [runtimes]);
  const [prompt, setPrompt] = useState("");
  const [repo, setRepo] = useState(repos[0]?.name ?? "");
  const [runtimeId, setRuntimeId] = useState(selectableRuntimes[0]?.id ?? "");
  const selectedRuntime = useMemo(() => selectableRuntimes.find((r) => r.id === runtimeId), [runtimeId, selectableRuntimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const rt = selectableRuntimes.find((r) => r.id === runtimeId);
    setModel(rt?.defaultModel ?? rt?.models?.[0] ?? "");
  }, [runtimeId, selectableRuntimes]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(28, Math.min(el.scrollHeight, 160)) + "px";
  }, [prompt]);

  async function handleSubmit(run: boolean) {
    if (!prompt.trim() || !repo) return;
    setBusy(true);
    setMessage(null);
    try {
      if (selectedRuntime?.executionMode === "interactive") {
        const res = await fetch("/api/agents/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo,
            prompt: prompt.trim(),
            runtimeId
          }),
        });
        const text = await res.text();
        const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
        if (result.ok) {
          setMessage({ text: `Opened ${selectedRuntime.label}`, ok: true });
          setPrompt("");
        } else {
          setMessage({ text: result.error || "Failed to launch agent", ok: false });
        }
        return;
      }

      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          title: prompt.trim().split("\n")[0].slice(0, 120),
          description: prompt.trim(),
          runtimeId,
          model,
          run,
        }),
      });
      const text = await res.text();
      const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
      if (result.ok) {
        setMessage({ text: `Task #${result.taskId} created`, ok: true });
        setPrompt("");
        setTimeout(() => window.location.reload(), 600);
      } else {
        setMessage({ text: result.error || "Failed to create task", ok: false });
      }
    } catch {
      setMessage({ text: "Request failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(true);
    }
  }

  const canSubmit = prompt.trim().length > 0 && repo && !busy && selectableRuntimes.length > 0;
  const modelOptions = selectedRuntime?.models ?? [];

  return (
    <div>
      {message && (
        <div className={`ag-message mb-3 ${message.ok ? "ag-message-success" : "ag-message-error"}`}>
          {message.text}
        </div>
      )}

      <div className="ag-hero-prompt">
        <textarea
          ref={textareaRef}
          className="ag-hero-prompt-input"
          placeholder="What do you want to build?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ overflow: "hidden" }}
        />

        {/* Bottom bar — always visible */}
        <div className="ag-hero-prompt-bar">
          <div className="ag-hero-prompt-meta">
            {/* Repo selector */}
            <select
              className="ag-inline-select"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            >
              {repos.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>

            {/* Runtime selector */}
            {selectableRuntimes.length > 0 && (
              <select
                className="ag-inline-select"
                value={runtimeId}
                onChange={(e) => setRuntimeId(e.target.value)}
                title={selectedRuntime?.marketSummary ?? "Select agent"}
              >
                {selectableRuntimes.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            )}

            {/* Model selector */}
            {modelOptions.length > 1 && (
              <select
                className="ag-inline-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          <div className="ag-hero-prompt-actions">
            <button
              className="ag-btn ag-btn-ghost ag-btn-sm"
              disabled={!canSubmit}
              onClick={() => handleSubmit(false)}
            >
              Save draft
            </button>
            <button
              className="ag-btn ag-btn-primary"
              disabled={!canSubmit}
              onClick={() => handleSubmit(true)}
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 12" strokeLinecap="round"/>
                  </svg>
                  Creating...
                </span>
              ) : (
                <>
                  {selectedRuntime?.executionMode === "interactive" ? "Open" : "Go"}
                  <kbd className="ml-1 text-[10px] opacity-60 font-mono">⌘↵</kbd>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type Runtime = { id: string; label: string; enabled: boolean; models?: string[]; defaultModel?: string | null };

function stageLabel(stage: string | null) {
  if (!stage) return "";
  return stage
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TaskActions({
  taskId,
  status,
  approvalStage,
  canRun,
  isWaiting,
  isTerminal,
  runtimes,
}: {
  taskId: number;
  status: string;
  approvalStage: string | null;
  canRun: boolean;
  isWaiting: boolean;
  isTerminal: boolean;
  runtimes: Runtime[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [runtimeId, setRuntimeId] = useState(runtimes.find((r) => r.enabled)?.id ?? "");
  const selectedRuntime = useMemo(() => runtimes.find((runtime) => runtime.id === runtimeId), [runtimeId, runtimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [showMore, setShowMore] = useState(false);

  const label = stageLabel(approvalStage);
  const enabled = runtimes.filter((r) => r.enabled);
  const isPlanningGate = approvalStage === "requirements" || approvalStage === "design";
  const isPrGate = approvalStage === "pr";
  const modelOptions = selectedRuntime?.models ?? [];

  useEffect(() => {
    const nextRuntime = runtimes.find((runtime) => runtime.id === runtimeId);
    setModel(nextRuntime?.defaultModel ?? nextRuntime?.models?.[0] ?? "");
  }, [runtimeId, runtimes]);

  async function doAction(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const result = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
      if (result.ok) {
        setMessage({ text: "Done", ok: true });
        setTimeout(() => window.location.reload(), 500);
      } else {
        setMessage({ text: result.error || "Failed", ok: false });
      }
    } catch {
      setMessage({ text: "Request failed", ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (isTerminal) {
    return (
      <span className={`ag-badge ${status === "MERGED" ? "ag-badge-success" : "ag-badge-danger"}`}>
        {status === "MERGED" ? "Merged" : "Rejected"}
      </span>
    );
  }

  /* ─── Waiting for approval ─── */
  if (isWaiting && approvalStage) {
    return (
      <div className="space-y-3">
        {message && (
          <div className={`ag-message ${message.ok ? "ag-message-success" : "ag-message-error"}`}>{message.text}</div>
        )}

        {/* Runtime selector — only for planning gates with multiple runtimes */}
        {enabled.length > 1 && isPlanningGate && (
          <div className="flex items-center gap-2">
            <select
              className="ag-select h-[28px] text-[12px]"
              style={{ width: "auto", minWidth: 130 }}
              value={runtimeId}
              onChange={(e) => setRuntimeId(e.target.value)}
            >
              {enabled.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {modelOptions.length > 0 && (
              <select
                className="ag-select h-[28px] text-[12px]"
                style={{ width: "auto", minWidth: 120 }}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {modelOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Primary action row */}
        <div className="flex items-center gap-2">
          {isPrGate ? (
            <button
              className="ag-btn ag-btn-success"
              disabled={busy}
              onClick={() => doAction("/api/tasks/pr", { taskId })}
            >
              {busy ? "Opening..." : "Approve & Open PR"}
            </button>
          ) : (
            <button
              className="ag-btn ag-btn-success"
              disabled={busy}
              onClick={() => doAction("/api/tasks/approve", { taskId, stage: approvalStage, runtimeId, model, autoRun: true })}
            >
              {busy ? "..." : isPlanningGate ? `Approve & Run Next` : `Approve ${label}`}
            </button>
          )}
          <button
            className="ag-btn ag-btn-danger ag-btn-sm"
            disabled={busy}
            onClick={() => doAction("/api/tasks/reject", { taskId, stage: approvalStage })}
          >
            Reject
          </button>
        </div>

        {/* Secondary actions — collapsed by default */}
        {(isPlanningGate || !isPrGate) && (
          <div>
            <button
              className="text-[11px] text-[var(--ag-text-4)] hover:text-[var(--ag-text-3)] transition-colors"
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? "Less options" : "More options..."}
            </button>
            {showMore && (
              <div className="flex items-center gap-2 mt-2 ag-animate-in">
                <button
                  className="ag-btn ag-btn-ghost ag-btn-sm"
                  disabled={busy}
                  onClick={() => doAction("/api/tasks/approve", { taskId, stage: approvalStage, autoRun: false })}
                >
                  Approve Only
                </button>
                {isPlanningGate && (
                  <button
                    className="ag-btn ag-btn-ghost ag-btn-sm"
                    disabled={busy}
                    onClick={() => doAction("/api/tasks/approve-planning", { taskId, runtimeId, model })}
                  >
                    Skip All Planning
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── Can run next stage ─── */
  if (canRun) {
    return (
      <div className="flex items-center gap-2">
        {message && (
          <span className={`ag-message ${message.ok ? "ag-message-success" : "ag-message-error"}`}>{message.text}</span>
        )}
        {enabled.length > 1 && (
          <select
            className="ag-select h-[34px] text-[12px]"
            style={{ width: "auto", minWidth: 130 }}
            value={runtimeId}
            onChange={(e) => setRuntimeId(e.target.value)}
          >
            {enabled.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        )}
        {modelOptions.length > 0 && (
          <select
            className="ag-select h-[34px] text-[12px]"
            style={{ width: "auto", minWidth: 120 }}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {modelOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )}
        <button
          className="ag-btn ag-btn-primary"
          disabled={busy || !runtimeId}
          onClick={() => doAction("/api/tasks/run", { taskId, runtimeId, model })}
        >
          {busy ? "Running..." : "Run Next Stage"}
        </button>
      </div>
    );
  }

  /* ─── Processing state ─── */
  return <span className="ag-badge ag-badge-active">Processing</span>;
}

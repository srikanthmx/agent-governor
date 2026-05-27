"use client";

import { useState } from "react";

type Runtime = { id: string; label: string; enabled: boolean };

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
  const approvalLabel = stageLabel(approvalStage);
  const enabledRuntimes = runtimes.filter((r) => r.enabled);
  const isPlanningGate = approvalStage === "requirements" || approvalStage === "design";
  const isPrGate = approvalStage === "pr";

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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {message && (
        <span className={`ag-message ${message.ok ? "ag-message-success" : "ag-message-error"}`}>
          {message.text}
        </span>
      )}

      {/* Approve / Reject for waiting states */}
      {isWaiting && approvalStage && (
        <>
          {enabledRuntimes.length > 1 && isPlanningGate && (
            <select
              className="ag-select h-[28px] text-[12px]"
              style={{ width: "auto", minWidth: 110 }}
              value={runtimeId}
              onChange={(e) => setRuntimeId(e.target.value)}
            >
              {enabledRuntimes.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          )}
          {isPrGate ? (
            <button
              className="ag-btn ag-btn-success ag-btn-sm"
              disabled={busy}
              onClick={() => doAction("/api/tasks/pr", { taskId })}
            >
              {busy ? "..." : "Approve & Open PR"}
            </button>
          ) : (
            <button
              className="ag-btn ag-btn-success ag-btn-sm"
              disabled={busy}
              onClick={() => doAction("/api/tasks/approve", { taskId, stage: approvalStage, runtimeId, autoRun: true })}
            >
              {busy ? "..." : isPlanningGate ? `Approve ${approvalLabel} & Run Next` : `Approve ${approvalLabel}`}
            </button>
          )}
          {isPlanningGate && (
            <button
              className="ag-btn ag-btn-primary ag-btn-sm"
              disabled={busy}
              onClick={() => doAction("/api/tasks/approve-planning", { taskId, runtimeId })}
            >
              Approve Planning Gates
            </button>
          )}
          <button
            className="ag-btn ag-btn-ghost ag-btn-sm"
            disabled={busy}
            onClick={() => doAction("/api/tasks/approve", { taskId, stage: approvalStage, autoRun: false })}
          >
            Approve Only
          </button>
          <button
            className="ag-btn ag-btn-danger ag-btn-sm"
            disabled={busy}
            onClick={() => doAction("/api/tasks/reject", { taskId, stage: approvalStage })}
          >
            Reject {approvalLabel}
          </button>
        </>
      )}

      {/* Run for actionable states */}
      {canRun && (
        <>
          {enabledRuntimes.length > 1 && (
            <select
              className="ag-select h-[28px] text-[12px]"
              style={{ width: "auto", minWidth: 110 }}
              value={runtimeId}
              onChange={(e) => setRuntimeId(e.target.value)}
            >
              {enabledRuntimes.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          )}
          <button
            className="ag-btn ag-btn-primary ag-btn-sm"
            disabled={busy || !runtimeId}
            onClick={() => doAction("/api/tasks/run", { taskId, runtimeId })}
          >
            {busy ? "Running..." : "Run Next Stage"}
          </button>
        </>
      )}

      {/* In-progress indicator */}
      {!isWaiting && !canRun && (
        <span className="ag-badge ag-badge-active">Processing</span>
      )}
    </div>
  );
}

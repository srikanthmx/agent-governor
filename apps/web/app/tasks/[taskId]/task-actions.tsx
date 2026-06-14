"use client";

import { useEffect, useMemo, useState } from "react";

type Runtime = { id: string; label: string; enabled: boolean; models?: string[]; defaultModel?: string | null; executionMode?: "headless" | "interactive" };

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
  hasApprovalForStage,
  canRun,
  isWaiting,
  isTerminal,
  runtimes,
}: {
  taskId: number;
  status: string;
  approvalStage: string | null;
  hasApprovalForStage: boolean;
  canRun: boolean;
  isWaiting: boolean;
  isTerminal: boolean;
  runtimes: Runtime[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const headlessRuntimes = useMemo(() => runtimes.filter((runtime) => runtime.enabled && runtime.executionMode !== "interactive"), [runtimes]);
  const [runtimeId, setRuntimeId] = useState(headlessRuntimes[0]?.id ?? "");
  const selectedRuntime = useMemo(() => headlessRuntimes.find((runtime) => runtime.id === runtimeId), [runtimeId, headlessRuntimes]);
  const [model, setModel] = useState(selectedRuntime?.defaultModel ?? selectedRuntime?.models?.[0] ?? "");
  const [showMore, setShowMore] = useState(false);

  const label = stageLabel(approvalStage);
  const enabled = headlessRuntimes;
  const isPlanningGate = approvalStage === "requirements" || approvalStage === "design";
  const isPrGate = approvalStage === "pr";
  const modelOptions = selectedRuntime?.models ?? [];
  const runLabel = approvalStage === "requirements"
    ? "Run Design"
    : approvalStage === "design"
      ? "Run Implementation"
      : "Run Next Stage";

  useEffect(() => {
    const nextRuntime = headlessRuntimes.find((runtime) => runtime.id === runtimeId);
    setModel(nextRuntime?.defaultModel ?? nextRuntime?.models?.[0] ?? "");
  }, [runtimeId, headlessRuntimes]);

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

  if (status === "PR_OPENED") {
    return <span className="ag-badge ag-badge-success">PR Opened</span>;
  }

  /* ─── Waiting for approval ─── */
  if (isWaiting && approvalStage) {
    return (
      <div className="space-y-3">
        {message && (
          <div className={`ag-message ${message.ok ? "ag-message-success" : "ag-message-error"}`}>{message.text}</div>
        )}

        {hasApprovalForStage && (
          <div className="ag-message ag-message-success">Approved. Start the next command when ready.</div>
        )}

        {/* Runtime selector — only before running the next CLI stage */}
        {enabled.length > 1 && isPlanningGate && hasApprovalForStage && (
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
          {isPrGate && hasApprovalForStage ? (
            <button
              className="ag-btn ag-btn-success"
              disabled={busy}
              onClick={() => doAction("/api/tasks/pr", { taskId })}
            >
              {busy ? "Opening..." : "Open PR"}
            </button>
          ) : isPrGate ? (
            <button
              className="ag-btn ag-btn-success"
              disabled={busy}
              onClick={() => doAction("/api/tasks/approve", { taskId, stage: approvalStage, autoRun: false })}
            >
              {busy ? "..." : "Approve PR"}
            </button>
          ) : hasApprovalForStage ? (
            <button
              className="ag-btn ag-btn-primary"
              disabled={busy || !runtimeId}
              onClick={() => doAction("/api/tasks/run", { taskId, runtimeId, model })}
            >
              {busy ? "Running..." : runLabel}
            </button>
          ) : (
            <button
              className="ag-btn ag-btn-success"
              disabled={busy}
              onClick={() => doAction("/api/tasks/approve", { taskId, stage: approvalStage, autoRun: false })}
            >
              {busy ? "..." : `Approve ${label}`}
            </button>
          )}
          {!hasApprovalForStage && (
            <button
              className="ag-btn ag-btn-danger ag-btn-sm"
              disabled={busy}
              onClick={() => doAction("/api/tasks/reject", { taskId, stage: approvalStage })}
            >
              Reject
            </button>
          )}
        </div>

        {/* Secondary actions — collapsed by default */}
        {!hasApprovalForStage && !isPrGate && (
          <div>
            <button
              className="text-[11px] text-[var(--ag-text-4)] hover:text-[var(--ag-text-3)] transition-colors"
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? "Less options" : "More options..."}
            </button>
            {showMore && (
              <div className="flex items-center gap-2 mt-2 ag-animate-in">
                <div className="text-[11px] text-[var(--ag-text-4)]">
                  Approval is explicit. The next CLI stage starts only from the run button shown after approval.
                </div>
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

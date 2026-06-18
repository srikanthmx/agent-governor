"use client";

import { useState } from "react";

type WorkerNode = {
  id: string;
  name: string;
  mode: string;
  effectiveStatus: "online" | "stale" | "offline";
  runtimes: string[];
  capabilities: string[];
  repoAllowlist: string[];
  lastSeenAgeSec: number;
  activeClaims: number;
};

function statusBadge(status: WorkerNode["effectiveStatus"]) {
  if (status === "online") return "ag-badge-success";
  if (status === "stale") return "ag-badge-waiting";
  return "ag-badge-muted";
}

export function NodeList({ nodes }: { nodes: WorkerNode[] }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function disconnect(node: WorkerNode) {
    if (!window.confirm(`Disconnect ${node.name}? The worker can re-enroll later with a new node token.`)) return;
    setRemoving(node.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({ ok: false, error: "Empty response" }));
      if (!result.ok) {
        setMessage(result.error ?? "Disconnect failed");
        return;
      }
      window.location.reload();
    } finally {
      setRemoving(null);
    }
  }

  if (nodes.length === 0) {
    return (
      <div className="ag-card ag-empty">
        <div className="ag-empty-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10h12M10 4v12" stroke="var(--ag-text-4)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="ag-empty-title">No worker nodes yet</div>
        <div className="ag-empty-description">Start the worker command above. The node will appear here after registration and heartbeat.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message && <div className="ag-message ag-message-error">{message}</div>}
      {nodes.map((node) => (
        <div key={node.id} className="ag-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--ag-text-1)]">{node.name}</h2>
                <span className={`ag-badge ${statusBadge(node.effectiveStatus)}`}>{node.effectiveStatus}</span>
                <span className="ag-badge ag-badge-neutral">{node.mode}</span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-[var(--ag-text-4)]">{node.id}</div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Metric label="Last seen" value={`${node.lastSeenAgeSec}s ago`} tone={node.effectiveStatus === "online" ? "good" : "warn"} />
                <Metric label="Runtimes" value={String(node.runtimes.length)} />
                <Metric label="Allowed repos" value={node.repoAllowlist.length ? String(node.repoAllowlist.length) : "all"} tone={node.repoAllowlist.length ? "good" : "warn"} />
                <Metric label="Claims" value={String(node.activeClaims)} />
              </div>
            </div>
            <button className="ag-btn ag-btn-danger" disabled={removing === node.id} onClick={() => disconnect(node)}>
              {removing === node.id ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <ListBlock title="Runtimes" items={node.runtimes} empty="No runtime heartbeat yet" />
            <ListBlock title="Capabilities" items={node.capabilities} empty="No capabilities reported" />
            <ListBlock title="Repo Allowlist" items={node.repoAllowlist} empty="All repos eligible. Set AG_WORKER_REPO_ALLOWLIST for production." />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-[var(--ag-green)]" : tone === "warn" ? "text-[var(--ag-amber)]" : "text-[var(--ag-text-1)]";
  return (
    <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
      <div className="text-[11px] text-[var(--ag-text-4)]">{label}</div>
      <div className={`mt-1 text-[13px] font-medium ${color}`}>{value}</div>
    </div>
  );
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
      <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">{title}</div>
      {items.length === 0 ? (
        <div className="text-[12px] leading-5 text-[var(--ag-text-3)]">{empty}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded bg-[var(--ag-raised)] px-2 py-1 text-[11px] text-[var(--ag-text-2)]">{item}</span>
          ))}
        </div>
      )}
    </div>
  );
}

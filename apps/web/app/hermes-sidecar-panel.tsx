"use client";

import { useEffect, useState } from "react";

type HermesSidecarStatus = {
  installed: boolean;
  configured: boolean;
  running: boolean;
  pid: number | null;
  baseUrl: string;
  health: "ok" | "unreachable" | "unknown";
  repoPath: string;
  logPath: string;
  setupCommand: string;
  startCommand: string;
  message: string;
};

type SidecarResponse = {
  ok: boolean;
  action?: string;
  error?: string;
  sidecar?: HermesSidecarStatus;
  status?: HermesSidecarStatus;
};

function badgeClass(status?: HermesSidecarStatus) {
  if (status?.running && status.health === "ok") return "ag-badge-success";
  if (status?.configured) return "ag-badge-waiting";
  return "ag-badge-neutral";
}

function statusText(status?: HermesSidecarStatus) {
  if (!status) return "checking";
  if (status.running && status.health === "ok") return "running";
  if (status.running) return "starting";
  if (status.configured) return "ready";
  if (status.installed) return "setup needed";
  return "missing";
}

export function HermesSidecarPanel() {
  const [status, setStatus] = useState<HermesSidecarStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const response = await fetch("/api/hermes/sidecar", { cache: "no-store" });
    const data = await response.json() as SidecarResponse;
    if (!response.ok || !data.ok) {
      setError(data.error ?? "Unable to read Hermes sidecar status.");
      return;
    }
    setStatus(data.sidecar ?? null);
  }

  async function runAction(action: "bootstrap" | "start" | "stop") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/hermes/sidecar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json() as SidecarResponse;
      setStatus(data.status ?? data.sidecar ?? null);
      if (!response.ok || !data.ok) {
        setError(data.error ?? `Hermes ${action} failed.`);
      }
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ag-card mb-5 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Hermes sidecar</div>
          <div className="mt-1 text-[15px] font-semibold text-[var(--ag-text-1)]">Parallel local Hermes Agent</div>
          <div className="mt-1 max-w-[680px] text-[12px] leading-relaxed text-[var(--ag-text-3)]">
            Governor controls the sidecar connection and can proxy Hermes API calls while routed coding work stays on opted-in desktop peers.
          </div>
        </div>
        <span className={`ag-badge ${badgeClass(status ?? undefined)}`}>{statusText(status ?? undefined)}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
          <div className="text-[11px] text-[var(--ag-text-4)]">Repo</div>
          <div className={status?.installed ? "mt-1 text-[12px] text-[var(--ag-green)]" : "mt-1 text-[12px] text-[var(--ag-text-4)]"}>
            {status?.installed ? "cloned" : "missing"}
          </div>
        </div>
        <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
          <div className="text-[11px] text-[var(--ag-text-4)]">Dependencies</div>
          <div className={status?.configured ? "mt-1 text-[12px] text-[var(--ag-green)]" : "mt-1 text-[12px] text-[var(--ag-amber)]"}>
            {status?.configured ? "installed" : "not installed"}
          </div>
        </div>
        <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
          <div className="text-[11px] text-[var(--ag-text-4)]">Hermes API</div>
          <div className="mt-1 font-mono text-[12px] text-[var(--ag-text-1)]">{status?.baseUrl ?? "127.0.0.1:8642"}</div>
        </div>
        <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
          <div className="text-[11px] text-[var(--ag-text-4)]">Proxy</div>
          <div className="mt-1 font-mono text-[12px] text-[var(--ag-text-1)]">/api/hermes/proxy/*</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="ag-btn ag-btn-secondary" disabled={Boolean(busy)} onClick={() => refresh()}>
          Reload
        </button>
        <button className="ag-btn ag-btn-secondary" disabled={Boolean(busy) || status?.configured} onClick={() => runAction("bootstrap")}>
          {busy === "bootstrap" ? "Installing..." : "Install deps"}
        </button>
        <button className="ag-btn ag-btn-primary" disabled={Boolean(busy) || !status?.configured || status?.running} onClick={() => runAction("start")}>
          {busy === "start" ? "Starting..." : "Start Hermes"}
        </button>
        <button className="ag-btn ag-btn-secondary" disabled={Boolean(busy) || !status?.running} onClick={() => runAction("stop")}>
          {busy === "stop" ? "Stopping..." : "Stop Hermes"}
        </button>
      </div>

      <div className="mt-4 rounded-md bg-[var(--ag-bg)] p-3">
        <div className="text-[12px] text-[var(--ag-text-2)]">{error ?? status?.message ?? "Checking Hermes sidecar..."}</div>
        <div className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--ag-text-4)]">
          {status?.setupCommand ?? "cd vendor/hermes-agent && uv venv .venv --python 3.11 && uv pip install -e '.[web]'"}
        </div>
        <div className="mt-1 font-mono text-[11px] leading-relaxed text-[var(--ag-text-4)]">
          {status?.startCommand ?? "API_SERVER_ENABLED=true API_SERVER_KEY=change-me-local-dev .venv/bin/python -m hermes_cli.main gateway"}
        </div>
      </div>
    </div>
  );
}

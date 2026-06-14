"use client";

import { useEffect, useMemo, useState } from "react";

type Runtime = {
  id: string;
  label: string;
  type: string;
  enabled: boolean;
  detected: boolean;
  detectedCommand: string | null;
  command: string | null;
  capabilities: string[];
  defaultModel?: string | null;
  executionMode?: "headless" | "interactive";
  marketSummary?: string | null;
  marketRank?: number | null;
};

type LocalTool = {
  id: string;
  label: string;
  kind: string;
  runnable: boolean;
  detected: boolean;
  detectedBy: string | null;
  capabilities: string[];
  promptRunnable?: boolean;
  status?: string;
  reason?: string;
  installCommand?: string;
  installUrl?: string;
  setupCommand?: string;
  notes?: string;
  marketRank?: number;
  marketSummary?: string;
  researchUpdatedAt?: string;
};

type IntegrationStatus = {
  ok: boolean;
  telegram: {
    configured: boolean;
    bot: { reachable: boolean; username: string | null; id: number | null };
    pollerRunning: boolean;
    webhookEndpoint: string;
    publicWebhookUrl: string | null;
    route: string;
    fallbackRoute: string;
    secretConfigured: boolean;
  };
  hermes: {
    desktop: {
      running: boolean;
      url: string;
      status: number | null;
      version: string | null;
      hermesHome: string | null;
      configPath: string | null;
      authRequired: boolean;
    };
    apiSidecar: {
      running: boolean;
      baseUrl: string;
      health: "ok" | "unreachable" | "unknown";
      message: string;
    };
    configPath: string;
    configuredModel: string | null;
    modelTarget: string | null;
    modelAdapter: {
      endpoint: string;
      backend: string;
      codexModel: string;
    };
  };
};

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  return text ? JSON.parse(text) : { ok: false, error: "Empty response" };
}

function statusBadge(tool: LocalTool) {
  if (tool.promptRunnable) return { label: "Runnable", className: "ag-badge-success" };
  if (tool.detected) return { label: "Needs bridge", className: "ag-badge-waiting" };
  return { label: "Install", className: "ag-badge-neutral" };
}

function integrationBadge(active: boolean, label?: string) {
  return (
    <span className={`ag-badge ag-badge-sm ${active ? "ag-badge-success" : "ag-badge-neutral"}`}>
      {label ?? (active ? "Ready" : "Off")}
    </span>
  );
}

export function AgentSettingsPanel({ runtimes, localTools }: { runtimes: Runtime[]; localTools: LocalTool[] }) {
  const runnableRuntimes = runtimes.filter((r) => r.enabled);
  const dryRunnableRuntimes = runnableRuntimes.filter((r) => r.executionMode !== "interactive");
  const rankedTools = useMemo(
    () => [...localTools].sort((a, b) => (a.marketRank ?? 999) - (b.marketRank ?? 999) || a.label.localeCompare(b.label)),
    [localTools]
  );
  const researchDate = rankedTools.find((tool) => tool.researchUpdatedAt)?.researchUpdatedAt;
  const [dryRunId, setDryRunId] = useState<string | null>(null);
  const [dryRunMessage, setDryRunMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [reloadBusy, setReloadBusy] = useState(false);
  const [reloadMessage, setReloadMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState<string | null>(null);
  const [integrationMessage, setIntegrationMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function refreshIntegrations() {
    const result = await api("/api/integrations/status");
    setIntegrationStatus(result);
  }

  useEffect(() => {
    refreshIntegrations().catch(() => {
      setIntegrationMessage({ text: "Integration status is unavailable.", ok: false });
    });
  }, []);

  async function dryRun(runtime: Runtime) {
    setDryRunId(runtime.id);
    setDryRunMessage(null);
    try {
      const result = await api("/api/agents/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runtimeId: runtime.id, model: runtime.defaultModel }),
      });
      setDryRunMessage({
        text: result.ok ? `${runtime.label} dry run passed. Logs: ${result.logsPath}` : result.error ?? "Dry run failed",
        ok: result.ok
      });
    } finally {
      setDryRunId(null);
    }
  }

  async function reloadAgents() {
    setReloadBusy(true);
    setReloadMessage(null);
    try {
      const result = await api("/api/agents/reload", { method: "POST" });
      const geminiText = result.gemini
        ? ` Gemini: ${result.gemini.promptRunnable ? `ready at ${result.gemini.detectedBy}` : result.gemini.reason}.`
        : "";
      setReloadMessage({
        text: result.ok ? `Reloaded agents: ${result.runnableCount} runnable, ${result.detectedCount} detected.${geminiText}` : result.error ?? "Reload failed",
        ok: Boolean(result.ok)
      });
      if (result.ok) {
        setTimeout(() => window.location.reload(), 900);
      }
    } catch {
      setReloadMessage({ text: "Reload failed", ok: false });
    } finally {
      setReloadBusy(false);
    }
  }

  async function setHermesSidecar(action: "start" | "stop") {
    setIntegrationBusy(action);
    setIntegrationMessage(null);
    try {
      const result = await api("/api/hermes/sidecar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      setIntegrationMessage({
        text: result.ok ? `Hermes API sidecar ${action === "start" ? "started" : "stopped"}.` : result.error ?? `Hermes ${action} failed.`,
        ok: Boolean(result.ok)
      });
      await refreshIntegrations();
    } catch {
      setIntegrationMessage({ text: `Hermes ${action} failed.`, ok: false });
    } finally {
      setIntegrationBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {dryRunMessage && (
        <div className={`ag-message ${dryRunMessage.ok ? "ag-message-success" : "ag-message-error"}`}>
          {dryRunMessage.text}
        </div>
      )}
      {reloadMessage && (
        <div className={`ag-message ${reloadMessage.ok ? "ag-message-info" : "ag-message-error"}`}>
          {reloadMessage.text}
        </div>
      )}
      {integrationMessage && (
        <div className={`ag-message ${integrationMessage.ok ? "ag-message-info" : "ag-message-error"}`}>
          {integrationMessage.text}
        </div>
      )}

      <div className="ag-card p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Integrations</h3>
            <p className="mt-0.5 text-[12px] text-[var(--ag-text-4)]">
              Telegram routes into Hermes when the API sidecar is running. Hermes uses Governor as an OpenAI-compatible runtime gateway.
            </p>
          </div>
          <button className="ag-btn ag-btn-ghost ag-btn-sm" onClick={() => refreshIntegrations()} disabled={Boolean(integrationBusy)}>
            Refresh
          </button>
        </div>

        {!integrationStatus ? (
          <div className="rounded-lg border border-[var(--ag-border)] bg-[var(--ag-bg)] p-4 text-[13px] text-[var(--ag-text-3)]">
            Checking integration status...
          </div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="rounded-lg border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Telegram</div>
                {integrationBadge(integrationStatus.telegram.configured && integrationStatus.telegram.bot.reachable)}
              </div>
              <div className="space-y-1 text-[11px] text-[var(--ag-text-3)]">
                <div>Bot: {integrationStatus.telegram.bot.username ? `@${integrationStatus.telegram.bot.username}` : "not reachable"}</div>
                <div>Poller: {integrationStatus.telegram.pollerRunning ? "running" : "not running"}</div>
                <div className="truncate">Webhook: {integrationStatus.telegram.publicWebhookUrl ?? integrationStatus.telegram.webhookEndpoint}</div>
                <div className="truncate">Route: {integrationStatus.telegram.route}</div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Hermes Desktop</div>
                {integrationBadge(integrationStatus.hermes.desktop.running)}
              </div>
              <div className="space-y-1 text-[11px] text-[var(--ag-text-3)]">
                <div className="truncate">Backend: {integrationStatus.hermes.desktop.url}</div>
                <div>Version: {integrationStatus.hermes.desktop.version ?? "unknown"}</div>
                <div className="truncate">Config: {integrationStatus.hermes.desktop.configPath ?? integrationStatus.hermes.configPath}</div>
                <div>Auth: {integrationStatus.hermes.desktop.authRequired ? "required" : "local"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Hermes API</div>
                {integrationBadge(integrationStatus.hermes.apiSidecar.running && integrationStatus.hermes.apiSidecar.health === "ok")}
              </div>
              <div className="space-y-1 text-[11px] text-[var(--ag-text-3)]">
                <div className="truncate">Sidecar: {integrationStatus.hermes.apiSidecar.baseUrl}</div>
                <div>Health: {integrationStatus.hermes.apiSidecar.health}</div>
                <div className="truncate">Model: {integrationStatus.hermes.configuredModel ?? "not set"}</div>
                <div className="truncate">Target: {integrationStatus.hermes.modelTarget ?? "not set"}</div>
                <div className="truncate">Backend: {integrationStatus.hermes.modelAdapter.backend} / {integrationStatus.hermes.modelAdapter.codexModel}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="ag-btn ag-btn-ghost ag-btn-sm" disabled={integrationBusy === "start"} onClick={() => setHermesSidecar("start")}>
                  {integrationBusy === "start" ? "Starting..." : "Start API"}
                </button>
                <button className="ag-btn ag-btn-ghost ag-btn-sm" disabled={integrationBusy === "stop"} onClick={() => setHermesSidecar("stop")}>
                  {integrationBusy === "stop" ? "Stopping..." : "Stop API"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ag-card p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Usable Agents</h3>
            <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5">
              These runtimes can receive prompts now. {runnableRuntimes.length} usable, {dryRunnableRuntimes.length} command-line dry runnable.
            </p>
          </div>
          <button className="ag-btn ag-btn-ghost ag-btn-sm" disabled={reloadBusy} onClick={reloadAgents}>
            {reloadBusy ? "Reloading..." : "Reload agents"}
          </button>
        </div>

        {runnableRuntimes.length === 0 ? (
          <div className="rounded-lg border border-[var(--ag-border)] bg-[var(--ag-bg)] p-4 text-[13px] text-[var(--ag-text-3)]">
            No usable agents detected. Install one from Agent Market below, then rescan.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {runnableRuntimes.map((runtime) => (
              <div
                key={runtime.id}
                className="p-3 rounded-lg border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.03)]"
              >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[13px] font-medium text-[var(--ag-text-1)] truncate">{runtime.label}</span>
                <span className="ag-badge ag-badge-sm ag-badge-success">
                  {runtime.executionMode === "interactive" ? "Opens app" : "CLI"}
                </span>
              </div>
              {(runtime.detectedCommand || runtime.command) && (
                <div className="font-mono text-[11px] text-[var(--ag-text-4)] mt-1 truncate">{runtime.detectedCommand ?? runtime.command}</div>
              )}
              {runtime.marketSummary && (
                <div className="text-[11px] text-[var(--ag-text-3)] mt-1 line-clamp-2">{runtime.marketSummary}</div>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {runtime.capabilities.map((capability) => (
                  <span key={capability} className="text-[10px] font-medium text-[var(--ag-text-4)] uppercase tracking-wider bg-[var(--ag-raised)] px-1.5 py-0.5 rounded">{capability}</span>
                ))}
              </div>
              {runtime.executionMode === "interactive" ? (
                <div className="mt-3 text-[11px] text-[var(--ag-text-4)]">
                  No command-line dry run. This target opens the app with the repo and prompt file.
                </div>
              ) : (
                <button className="ag-btn ag-btn-ghost ag-btn-sm mt-3" disabled={dryRunId === runtime.id} onClick={() => dryRun(runtime)}>
                  {dryRunId === runtime.id ? "Running..." : "Dry run sample repo"}
                </button>
              )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ag-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Agent Market</h3>
            <p className="text-[12px] text-[var(--ag-text-4)] mt-0.5">
              Missing means Governor cannot route prompts to it yet. Install it or configure a bridge, then rescan. Market research stamp{researchDate ? `: ${researchDate}.` : " updates on each scan."}
            </p>
          </div>
          <button className="ag-btn ag-btn-ghost ag-btn-sm" disabled={reloadBusy} onClick={reloadAgents}>
            {reloadBusy ? "Reloading..." : "Reload agents"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rankedTools.map((tool) => {
            const badge = statusBadge(tool);
            return (
              <div key={tool.id} className="flex min-h-[126px] flex-col justify-between gap-3 rounded-lg border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {tool.marketRank && <span className="text-[10px] text-[var(--ag-text-4)]">#{tool.marketRank}</span>}
                      <div className="truncate text-[13px] font-medium text-[var(--ag-text-1)]">{tool.label}</div>
                    </div>
                    <span className={`ag-badge ag-badge-sm ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-[var(--ag-text-4)]">{tool.reason ?? tool.kind}</div>
                  {tool.marketSummary && (
                    <div className="mt-1 line-clamp-2 text-[10px] text-[var(--ag-text-3)]">{tool.marketSummary}</div>
                  )}
                  {tool.installCommand && !tool.promptRunnable && (
                    <code className="mt-2 block truncate text-[10px] text-[var(--ag-text-3)]">{tool.installCommand}</code>
                  )}
                  {tool.setupCommand && tool.promptRunnable && (
                    <code className="mt-2 block truncate text-[10px] text-[var(--ag-text-3)]">{tool.setupCommand}</code>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {tool.installUrl && (
                    <a className={`ag-btn ag-btn-sm ${tool.promptRunnable ? "ag-btn-ghost" : "ag-btn-primary"}`} href={tool.installUrl} target="_blank" rel="noreferrer">
                      {tool.promptRunnable ? "Docs" : tool.detected ? "Setup" : "Install"}
                    </a>
                  )}
                  {tool.detectedBy && (
                    <span className="min-w-0 truncate text-[10px] text-[var(--ag-text-4)]">{tool.detectedBy}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

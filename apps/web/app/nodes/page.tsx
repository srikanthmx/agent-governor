import { getDashboardData } from "../data";
import { NodeList } from "./node-list";

export const dynamic = "force-dynamic";

function eventBadge(eventType: string) {
  if (eventType.includes("denied")) return "ag-badge-danger";
  if (eventType.includes("issued") || eventType.includes("registered")) return "ag-badge-success";
  if (eventType.includes("claimed")) return "ag-badge-active";
  return "ag-badge-neutral";
}

function formatAge(sec: number) {
  if (!Number.isFinite(sec)) return "never";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

export default function NodesPage() {
  const { workerNodes, workerEvents, repos, githubAppConfigured } = getDashboardData();
  const onlineCount = workerNodes.filter((node) => node.effectiveStatus === "online").length;
  const allowlist = repos.map((repo) => repo.github).join(",");
  const workerCommand = [
    "AG_CONTROL_PLANE_URL=http://127.0.0.1:3002",
    allowlist ? `AG_WORKER_REPO_ALLOWLIST=${allowlist}` : "AG_WORKER_REPO_ALLOWLIST=owner/repo",
    "pnpm --filter @agent-governor/worker start"
  ].join(" \\\n  ");

  return (
    <div className="ag-animate-in">
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="ag-badge ag-badge-active">Worker fabric</span>
            <span className={`ag-badge ${githubAppConfigured ? "ag-badge-success" : "ag-badge-waiting"}`}>
              {githubAppConfigured ? "GitHub App ready" : "Local GitHub only"}
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--ag-text-1)]">Worker Nodes</h1>
          <p className="mt-1 max-w-[760px] text-[13px] leading-6 text-[var(--ag-text-3)]">
            Nodes are where work actually runs. Hermes, Telegram, or the web app can submit a task; an enrolled node claims it, runs the local CLI agent, and uses scoped GitHub credentials for PR work.
          </p>
        </div>
        <a className="ag-btn ag-btn-primary" href="/first-run">Open first run</a>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <div className="ag-stat">
          <div className="ag-stat-value">{workerNodes.length}</div>
          <div className="ag-stat-label">registered nodes</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value text-[var(--ag-green)]">{onlineCount}</div>
          <div className="ag-stat-label">online now</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">{new Set(workerNodes.flatMap((node) => node.runtimes)).size}</div>
          <div className="ag-stat-label">advertised runtimes</div>
        </div>
        <div className="ag-stat">
          <div className={`ag-stat-value ${githubAppConfigured ? "text-[var(--ag-green)]" : "text-[var(--ag-amber)]"}`}>
            {githubAppConfigured ? "ready" : "local"}
          </div>
          <div className="ag-stat-label">GitHub credential mode</div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="ag-card p-4">
          <div className="mb-2 text-[13px] font-medium text-[var(--ag-text-1)]">Start a Worker</div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[var(--ag-bg)] p-4 font-mono text-[12px] leading-5 text-[var(--ag-text-1)]">{workerCommand}</pre>
          <p className="mt-3 text-[12px] leading-5 text-[var(--ag-text-3)]">
            The worker stores only its node credential in data/worker-node.json. GitHub installation tokens are issued per repo request and are not persisted.
          </p>
        </div>

        <div className="ag-card p-4">
          <div className="mb-3 text-[13px] font-medium text-[var(--ag-text-1)]">Credential Boundary</div>
          <div className="space-y-2 text-[12px] leading-5 text-[var(--ag-text-3)]">
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              Desktop owner node: use local gh browser auth and OS keychain.
            </div>
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              Remote/shared node: use GitHub App installation tokens scoped to one repo.
            </div>
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              Control plane: stores node token hashes, task claims, and audit events. No PAT custody.
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <NodeList nodes={workerNodes} />

        <div className="ag-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="ag-section-label">Node Events</div>
            <span className="ag-badge ag-badge-neutral">{workerEvents.length}</span>
          </div>
          <div className="space-y-2">
            {workerEvents.length === 0 ? (
              <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-text-3)]">
                No node events yet.
              </div>
            ) : workerEvents.slice(0, 12).map((event) => (
              <div key={event.id} className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className={`ag-badge ag-badge-sm ${eventBadge(event.eventType)}`}>{event.eventType}</span>
                  <span className="font-mono text-[10px] text-[var(--ag-text-4)]">{formatAge(Math.max(0, Math.floor((Date.now() - new Date(event.createdAt).getTime()) / 1000)))} ago</span>
                </div>
                <div className="text-[12px] leading-5 text-[var(--ag-text-2)]">{event.message}</div>
                <div className="mt-1 text-[11px] text-[var(--ag-text-4)]">{event.nodeName ?? event.nodeId}{event.taskId ? ` · TASK-${event.taskId}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

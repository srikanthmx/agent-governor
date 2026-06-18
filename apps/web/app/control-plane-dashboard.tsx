import { getDashboardData } from "./data";
import { HermesSidecarPanel } from "./hermes-sidecar-panel";

function nodeBadge(status: string) {
  if (status === "online") return "ag-badge-success";
  if (status === "stale") return "ag-badge-waiting";
  return "ag-badge-muted";
}

function taskBadge(status: string) {
  if (status.includes("WAITING") || status === "PR_READY") return "ag-badge-waiting";
  if (status === "PR_OPENED" || status === "MERGED") return "ag-badge-success";
  if (status === "FAILED" || status === "REJECTED") return "ag-badge-danger";
  return "ag-badge-active";
}

function eventBadge(eventType: string) {
  if (eventType.includes("denied")) return "ag-badge-danger";
  if (eventType.includes("issued") || eventType.includes("registered")) return "ag-badge-success";
  if (eventType.includes("claimed")) return "ag-badge-active";
  return "ag-badge-neutral";
}

function ageLabel(date: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function ControlPlaneDashboard() {
  const { tasks, workerNodes, workerEvents, runtimes, repos, githubAppConfigured } = getDashboardData();
  const onlineNodes = workerNodes.filter((node) => node.effectiveStatus === "online");
  const sharedRuntimes = new Set(workerNodes.flatMap((node) => node.runtimes));
  const activeTasks = tasks.filter((task) => !["MERGED", "REJECTED"].includes(task.status));
  const waitingTasks = tasks.filter((task) => task.status.includes("WAITING") || task.status === "PR_READY");

  return (
    <div className="ag-animate-in">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="ag-badge ag-badge-success">Control plane</span>
            <span className="ag-badge ag-badge-active">Runtime router</span>
            <span className={`ag-badge ${githubAppConfigured ? "ag-badge-success" : "ag-badge-waiting"}`}>
              {githubAppConfigured ? "GitHub App tokens" : "Local GitHub mode"}
            </span>
          </div>
          <h1 className="text-[20px] font-semibold leading-tight text-[var(--ag-text-1)]">AI Runtime Operating System</h1>
          <p className="mt-1 max-w-[760px] text-[13px] leading-6 text-[var(--ag-text-3)]">
            Govern tasks from chat or Hermes, route them to opted-in worker nodes, audit execution, and raise PRs from the node that owns the repo credential boundary.
          </p>
        </div>
        <a className="ag-btn ag-btn-primary" href="/nodes">Manage nodes</a>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <div className="ag-stat">
          <div className="ag-stat-value">{activeTasks.length}</div>
          <div className="ag-stat-label">active tasks</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value text-[var(--ag-amber)]">{waitingTasks.length}</div>
          <div className="ag-stat-label">need approval</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value text-[var(--ag-green)]">{onlineNodes.length}</div>
          <div className="ag-stat-label">online nodes</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">{sharedRuntimes.size || runtimes.filter((runtime) => runtime.enabled).length}</div>
          <div className="ag-stat-label">routable runtimes</div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="ag-card ag-card-glow-blue p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="ag-section-label">Routing posture</div>
              <div className="mt-1 text-[16px] font-semibold text-[var(--ag-text-1)]">
                {onlineNodes.length > 0 ? `${onlineNodes.length} node${onlineNodes.length === 1 ? "" : "s"} ready to claim work` : "No worker node online"}
              </div>
            </div>
            <span className={`ag-badge ${onlineNodes.length > 0 ? "ag-badge-success" : "ag-badge-waiting"}`}>
              {onlineNodes.length > 0 ? "claimable" : "setup needed"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="Repos" value={String(repos.length)} />
            <MiniMetric label="GitHub" value={githubAppConfigured ? "App ready" : "local gh"} tone={githubAppConfigured ? "good" : "warn"} />
            <MiniMetric label="Events" value={String(workerEvents.length)} />
            <MiniMetric label="Claims" value={String(workerNodes.reduce((sum, node) => sum + node.activeClaims, 0))} />
          </div>
          <div className="mt-4 rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] leading-5 text-[var(--ag-text-3)]">
            Remote chat should never hold raw Git credentials. It creates or approves work; the selected node requests a short-lived repo token only when it needs to clone, push, or open a PR.
          </div>
        </div>

        <div className="ag-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Node Enrollment</div>
            <span className="ag-badge ag-badge-neutral">{workerNodes.length} registered</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[var(--ag-bg)] p-3 font-mono text-[11px] leading-5 text-[var(--ag-text-2)]">AG_CONTROL_PLANE_URL=https://your-governor-url{"\n"}AG_WORKER_REPO_ALLOWLIST=owner/repo{"\n"}pnpm --filter @agent-governor/worker start</pre>
          <a className="ag-btn ag-btn-secondary mt-3 w-full" href="/first-run">Open guided setup</a>
        </div>
      </div>

      <HermesSidecarPanel />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="ag-card">
            <div className="border-b border-[var(--ag-border)] px-4 py-3">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Worker Nodes</div>
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-3">
              {workerNodes.length === 0 ? (
                <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-4 text-[12px] text-[var(--ag-text-3)] lg:col-span-3">
                  No nodes have enrolled. Start a worker from `/nodes` or First Run.
                </div>
              ) : workerNodes.map((node) => (
                <a key={node.id} href="/nodes" className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 transition-colors hover:border-[var(--ag-border-bold)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="truncate font-medium text-[var(--ag-text-1)]">{node.name}</div>
                    <span className={`ag-badge ag-badge-sm ${nodeBadge(node.effectiveStatus)}`}>{node.effectiveStatus}</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <Row label="Last seen" value={`${node.lastSeenAgeSec}s ago`} />
                    <Row label="Runtimes" value={node.runtimes.join(", ") || "none"} tone="good" />
                    <Row label="Repos" value={node.repoAllowlist.length ? String(node.repoAllowlist.length) : "all"} tone={node.repoAllowlist.length ? "good" : "warn"} />
                    <Row label="Claims" value={String(node.activeClaims)} />
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="ag-card">
            <div className="border-b border-[var(--ag-border)] px-4 py-3">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Task Routing</div>
            </div>
            <div className="space-y-2 p-3">
              {activeTasks.length === 0 ? (
                <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-4 text-[12px] text-[var(--ag-text-3)]">No active tasks yet.</div>
              ) : activeTasks.slice(0, 8).map((task) => (
                <a key={task.id} href={`/tasks/${task.id}`} className="block rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 transition-colors hover:border-[var(--ag-border-bold)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-[var(--ag-text-4)]">TASK-{task.id} · {task.repo}</div>
                      <div className="truncate text-[13px] font-medium text-[var(--ag-text-1)]">{task.title}</div>
                    </div>
                    <span className={`ag-badge ${taskBadge(task.status)}`}>{task.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-[11px] text-[var(--ag-text-3)] md:grid-cols-3">
                    <div>Runtime: <span className="text-[var(--ag-text-2)]">{task.runtime}</span></div>
                    <div>Stage: <span className="text-[var(--ag-text-2)]">{task.stage ?? "intake"}</span></div>
                    <div>PR: <span className="text-[var(--ag-text-2)]">{task.pr ? "ready" : "not opened"}</span></div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="ag-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="ag-section-label">Node Event Stream</div>
              <span className="ag-badge ag-badge-neutral">{workerEvents.length}</span>
            </div>
            <div className="space-y-2">
              {workerEvents.length === 0 ? (
                <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-text-3)]">No node events yet.</div>
              ) : workerEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className={`ag-badge ag-badge-sm ${eventBadge(event.eventType)}`}>{event.eventType}</span>
                    <span className="font-mono text-[10px] text-[var(--ag-text-4)]">{ageLabel(event.createdAt)}</span>
                  </div>
                  <div className="text-[12px] leading-snug text-[var(--ag-text-2)]">{event.message}</div>
                  <div className="mt-1 text-[11px] text-[var(--ag-text-4)]">{event.nodeName ?? event.nodeId}{event.taskId ? ` · TASK-${event.taskId}` : ""}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Core APIs</div>
            <div className="space-y-2 font-mono text-[11px] text-[var(--ag-text-3)]">
              <div>POST /api/nodes</div>
              <div>POST /api/nodes/claim</div>
              <div>POST /api/nodes/github-token</div>
              <div>POST /api/hermes/v1/chat/completions</div>
              <div>POST /api/telegram/webhook</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-[var(--ag-green)]" : tone === "warn" ? "text-[var(--ag-amber)]" : "text-[var(--ag-text-1)]";
  return (
    <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
      <div className="text-[11px] text-[var(--ag-text-4)]">{label}</div>
      <div className={`mt-1 text-[13px] ${color}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-[var(--ag-green)]" : tone === "warn" ? "text-[var(--ag-amber)]" : "text-[var(--ag-text-2)]";
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--ag-text-4)]">{label}</span>
      <span className={`truncate text-right ${color}`}>{value}</span>
    </div>
  );
}

import Link from "next/link";
import { getDashboardData } from "./data";
import { PromptHero } from "./prompt-hero";

/* ─── Status config ─── */

const STATUS_META: Record<string, { label: string; badge: string; action: string; priority: number }> = {
  NEW:                          { label: "New",            badge: "ag-badge-neutral",  action: "Start",              priority: 5 },
  CONTEXT_READY:                { label: "Ready",          badge: "ag-badge-neutral",  action: "Run",                priority: 4 },
  REQUIREMENTS_GENERATING:      { label: "Generating",     badge: "ag-badge-active",   action: "Agent working...",    priority: 3 },
  WAITING_REQUIREMENTS_APPROVAL:{ label: "Review",         badge: "ag-badge-waiting",  action: "Approve requirements", priority: 0 },
  DESIGN_GENERATING:            { label: "Designing",      badge: "ag-badge-active",   action: "Agent working...",    priority: 3 },
  WAITING_DESIGN_APPROVAL:      { label: "Review",         badge: "ag-badge-waiting",  action: "Approve design",     priority: 0 },
  IMPLEMENTING:                 { label: "Building",       badge: "ag-badge-active",   action: "Agent building...",   priority: 3 },
  TESTING:                      { label: "Testing",        badge: "ag-badge-active",   action: "Running tests...",    priority: 3 },
  REVIEWING:                    { label: "Reviewing",      badge: "ag-badge-active",   action: "Under review...",     priority: 3 },
  FIXING:                       { label: "Fixing",         badge: "ag-badge-active",   action: "Fixing issues...",    priority: 2 },
  PR_READY:                     { label: "PR ready",       badge: "ag-badge-waiting",  action: "Open PR",            priority: 1 },
  PR_OPENED:                    { label: "PR open",        badge: "ag-badge-success",  action: "Review PR",          priority: 2 },
  WAITING_PR_APPROVAL:          { label: "Review PR",      badge: "ag-badge-waiting",  action: "Approve PR",         priority: 0 },
  WAITING_MERGE_APPROVAL:       { label: "Merge?",         badge: "ag-badge-waiting",  action: "Approve merge",      priority: 0 },
  MERGED:                       { label: "Merged",         badge: "ag-badge-success",  action: "",                   priority: 9 },
  FAILED:                       { label: "Failed",         badge: "ag-badge-danger",   action: "Investigate",        priority: 1 },
  REJECTED:                     { label: "Rejected",       badge: "ag-badge-danger",   action: "",                   priority: 9 },
};

function meta(status: string) {
  return STATUS_META[status] ?? { label: status, badge: "ag-badge-neutral", action: "", priority: 5 };
}

/* ─── Pipeline mapping ─── */

function pipelineStage(status: string): string {
  if (["NEW", "CONTEXT_READY"].includes(status)) return "intake";
  if (status.includes("REQUIREMENTS")) return "requirements";
  if (status.includes("DESIGN")) return "design";
  if (["IMPLEMENTING", "TESTING", "REVIEWING", "FIXING"].includes(status)) return "build";
  if (status.includes("PR") || status.includes("MERGE") || status === "MERGED") return "ship";
  return "intake";
}

const PIPELINE = [
  { id: "intake",       label: "Intake" },
  { id: "requirements", label: "Reqs" },
  { id: "design",       label: "Design" },
  { id: "build",        label: "Build" },
  { id: "ship",         label: "Ship" },
];

/* ─── Page ─── */

export function LocalDashboard() {
  const { tasks, runtimes, repos } = getDashboardData();

  const needsSetup = repos.length === 0;
  const waitingTasks = tasks.filter((t) => t.status.includes("WAITING"));
  const activeTasks = tasks.filter((t) => !["MERGED", "REJECTED"].includes(t.status));
  const enabledAgents = runtimes.filter((r) => r.enabled);

  // Sort: approval-needed first, then active, then terminal
  const sorted = [...tasks].sort((a, b) => {
    const pa = meta(a.status).priority;
    const pb = meta(b.status).priority;
    return pa - pb || b.id - a.id;
  });

  // Pipeline distribution
  const pipelineCounts = PIPELINE.map((p) => ({
    ...p,
    count: tasks.filter((t) => pipelineStage(t.status) === p.id && !["MERGED", "REJECTED"].includes(t.status)).length,
  }));

  return (
    <div className="ag-animate-in">
      {/* ═══ Setup banner ═══ */}
      {needsSetup && (
        <div className="ag-card ag-card-glow-blue p-6 mb-8">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--ag-text-1)]">Welcome to Agent Governor</h2>
              <p className="text-[13px] text-[var(--ag-text-3)] mt-1">Connect GitHub and add a repository to start routing work across your AI runtimes.</p>
            </div>
            <Link href="/setup" className="ag-btn ag-btn-primary ag-btn-xl">Get Started</Link>
          </div>
        </div>
      )}

      {/* ═══ HERO: The Prompt ═══ */}
      {!needsSetup && (
        <div className="mb-10">
          <PromptHero repos={repos} runtimes={runtimes} />
        </div>
      )}

      {/* ═══ Quick stats (compact row) ═══ */}
      <div className="flex items-center gap-6 mb-6 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-semibold text-[var(--ag-text-1)] tabular-nums">{activeTasks.length}</span>
          <span className="text-[12px] text-[var(--ag-text-3)]">active</span>
        </div>
        {waitingTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--ag-amber)] shadow-[0_0_8px_var(--ag-amber)]" />
            <span className="text-[20px] font-semibold text-[var(--ag-amber)] tabular-nums">{waitingTasks.length}</span>
            <span className="text-[12px] text-[var(--ag-text-3)]">need you</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-green)]" />
          <span className="text-[12px] text-[var(--ag-text-3)]">{enabledAgents.length} runtime{enabledAgents.length !== 1 ? "s" : ""} online</span>
        </div>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--ag-text-4)]">{tasks.length} total tasks</span>
      </div>

      {/* ═══ Pipeline ═══ */}
      {activeTasks.length > 0 && (
        <div className="ag-pipeline mb-6">
          {pipelineCounts.map((stage) => (
            <div key={stage.id} className={`ag-pipeline-stage ${stage.count > 0 ? "ag-pipeline-current" : ""}`}>
              <span>{stage.label}</span>
              {stage.count > 0 && <span className="ml-1.5 text-[10px] opacity-70">{stage.count}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ═══ Task list ═══ */}
      {tasks.length === 0 ? (
        <div className="ag-card ag-empty mt-4">
          <div className="ag-empty-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="var(--ag-text-4)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="ag-empty-title">No tasks yet</div>
          <div className="ag-empty-description">Describe what you want built above. Governor will route the work to the best available runtime and keep approvals visible.</div>
        </div>
      ) : (
        <div className="space-y-2 ag-stagger">
          {sorted.map((task) => {
            const m = meta(task.status);
            const isUrgent = m.priority === 0;
            const isTerminal = ["MERGED", "REJECTED"].includes(task.status);

            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className={`ag-task-row ag-animate-in ${isUrgent ? "ag-task-row-urgent" : ""} ${isTerminal ? "opacity-50 hover:opacity-80" : ""}`}
              >
                {/* Left: task info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[11px] text-[var(--ag-text-4)]">#{task.id}</span>
                    <span className="text-[11px] text-[var(--ag-text-4)]">{task.repo}</span>
                  </div>
                  <div className="text-[13px] font-medium text-[var(--ag-text-1)] truncate">{task.title}</div>
                </div>

                {/* Right: status + action hint */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {isUrgent && m.action && (
                    <span className="text-[12px] font-medium text-[var(--ag-amber)]">{m.action}</span>
                  )}
                  <span className={`ag-badge ${m.badge}`}>{m.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

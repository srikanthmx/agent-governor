import Link from "next/link";
import { getTaskDetail } from "../../data";
import { TaskActions } from "./task-actions";

/* ─── Pipeline stages ─── */
const STAGES = [
  { id: "requirements", label: "Requirements", statuses: ["NEW", "CONTEXT_READY", "REQUIREMENTS_GENERATING", "WAITING_REQUIREMENTS_APPROVAL"] },
  { id: "design",       label: "Design",       statuses: ["DESIGN_GENERATING", "WAITING_DESIGN_APPROVAL"] },
  { id: "implementation", label: "Implementation", statuses: ["IMPLEMENTING", "TESTING", "REVIEWING", "FIXING"] },
  { id: "pr",           label: "Pull Request",  statuses: ["PR_READY", "PR_OPENED", "WAITING_PR_APPROVAL"] },
  { id: "merge",        label: "Merge",         statuses: ["WAITING_MERGE_APPROVAL", "MERGED"] },
];

function resolveStageState(stageStatuses: string[], currentStatus: string) {
  const allStatuses = STAGES.flatMap((s) => s.statuses);
  const currentIdx = allStatuses.indexOf(currentStatus);
  const stageStartIdx = allStatuses.indexOf(stageStatuses[0]);
  const stageEndIdx = allStatuses.indexOf(stageStatuses[stageStatuses.length - 1]);

  if (currentIdx > stageEndIdx) return "done";
  if (currentIdx >= stageStartIdx && currentIdx <= stageEndIdx) return "current";
  return "upcoming";
}

function statusDescription(status: string): string {
  const map: Record<string, string> = {
    NEW: "Task created. Run requirements generation to begin.",
    CONTEXT_READY: "Context loaded. Ready to generate requirements.",
    REQUIREMENTS_GENERATING: "An agent is generating requirements...",
    WAITING_REQUIREMENTS_APPROVAL: "Requirements are ready for your review and approval.",
    DESIGN_GENERATING: "An agent is generating the design...",
    WAITING_DESIGN_APPROVAL: "Design is ready for your review and approval.",
    IMPLEMENTING: "An agent is implementing the changes in a git worktree...",
    TESTING: "Running automated tests...",
    REVIEWING: "Code is under review...",
    FIXING: "Agent is making requested changes...",
    PR_READY: "Implementation complete. Ready to open a pull request.",
    PR_OPENED: "Pull request has been opened.",
    WAITING_PR_APPROVAL: "Pull request is ready for your approval.",
    WAITING_MERGE_APPROVAL: "PR approved. Ready for merge approval.",
    MERGED: "Pull request has been merged. Task complete.",
    FAILED: "Something went wrong. Check the logs for details.",
    REJECTED: "This task was rejected.",
  };
  return map[status] ?? status;
}

function approvalStageForStatus(status: string): string | null {
  if (status === "WAITING_REQUIREMENTS_APPROVAL") return "requirements";
  if (status === "WAITING_DESIGN_APPROVAL") return "design";
  if (status === "WAITING_PR_APPROVAL") return "pr";
  if (status === "WAITING_MERGE_APPROVAL") return "merge";
  return null;
}

export default function TaskPage({ params }: { params: { taskId: string } }) {
  const { task, artifacts, approvals, diff, runs, runtimes } = getTaskDetail(Number(params.taskId));

  if (!task) {
    return (
      <div className="ag-card ag-empty">
        <div className="ag-empty-title">Task not found</div>
        <Link href="/" className="ag-btn ag-btn-ghost ag-btn-sm mt-4">Back to Dashboard</Link>
      </div>
    );
  }

  const isWaiting = task.status.includes("WAITING");
  const isTerminal = ["MERGED", "REJECTED"].includes(task.status);
  const canRun = ["NEW", "CONTEXT_READY", "FIXING"].includes(task.status);
  const approvalStage = approvalStageForStatus(task.status);

  // Pipeline state class
  function pipelineClass(stageStatuses: string[]) {
    const state = resolveStageState(stageStatuses, task!.status);
    if (task!.status === "FAILED" || task!.status === "REJECTED") return "";
    if (state === "done") return "ag-pipeline-done";
    if (state === "current") {
      return isWaiting ? "ag-pipeline-waiting" : "ag-pipeline-current";
    }
    return "";
  }

  return (
    <div className="ag-animate-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="text-[12px] text-[var(--ag-text-4)] hover:text-[var(--ag-text-3)] transition-colors">Dashboard</Link>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="var(--ag-text-4)" strokeWidth="1.2" strokeLinecap="round"/></svg>
        <span className="text-[12px] text-[var(--ag-text-3)] font-mono">#{task.id}</span>
      </div>

      {/* Header card */}
      <div className={`ag-card p-6 mb-6 ${isWaiting ? "ag-card-glow-amber" : isTerminal ? "" : "ag-card-glow-blue"}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] text-[var(--ag-text-4)]">TASK-{task.id}</span>
              <span className="text-[11px] text-[var(--ag-text-4)]">{task.repo}</span>
            </div>
            <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)] leading-tight">{task.title}</h1>
            {task.description && (
              <p className="text-[13px] text-[var(--ag-text-3)] mt-2 max-w-[600px]">{task.description}</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-[11px] text-[var(--ag-text-4)]">
          {task.branch && (
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2v5a2 2 0 002 2h4M3 4.5h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="9" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.1"/></svg>
              <span className="font-mono">{task.branch}</span>
            </span>
          )}
          {task.pr && (
            <a href={task.pr} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[var(--ag-blue)] hover:underline">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2v8M9 4v6M3 4a2 2 0 012-2h1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="3" cy="2" r="1" fill="currentColor"/><circle cx="9" cy="4" r="1" fill="currentColor"/><circle cx="3" cy="10" r="1" fill="currentColor"/><circle cx="9" cy="10" r="1" fill="currentColor"/></svg>
              Pull Request
            </a>
          )}
        </div>

        {/* Status + Actions */}
        <div className="mt-5 p-4 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold text-[var(--ag-text-4)] uppercase tracking-widest">Status</div>
              <div className="text-[13px] text-[var(--ag-text-2)] mt-1">{statusDescription(task.status)}</div>
            </div>
            <TaskActions
              taskId={task.id}
              status={task.status}
              approvalStage={approvalStage}
              canRun={canRun}
              isWaiting={isWaiting}
              isTerminal={isTerminal}
              runtimes={runtimes}
            />
          </div>
        </div>
      </div>

      {/* Pipeline bar */}
      <div className="ag-pipeline mb-6">
        {STAGES.map((stage) => (
          <div key={stage.id} className={`ag-pipeline-stage ${pipelineClass(stage.statuses)}`}>
            {stage.label}
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Artifacts */}
        <div>
          <div className="ag-section-label mb-3">Changes for PR</div>
          <div className="ag-card mb-6">
            <div className="border-b border-[var(--ag-border)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Worktree diff preview</div>
                  <div className="mt-1 text-[12px] text-[var(--ag-text-4)]">Review these file changes before approving and opening the PR.</div>
                </div>
                <span className="ag-badge ag-badge-neutral">{diff?.status ? "Changed" : "Clean"}</span>
              </div>
            </div>
            {diff?.status ? (
              <div>
                <div className="border-b border-[var(--ag-border)] p-4">
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ag-text-2)] font-mono">{diff.status}</pre>
                  {diff.stat ? <pre className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ag-text-3)] font-mono">{diff.stat}</pre> : null}
                </div>
                {diff.patch ? (
                  <details open>
                    <summary className="cursor-pointer px-4 py-3 text-[12px] font-medium text-[var(--ag-text-2)] hover:text-[var(--ag-text-1)]">Patch</summary>
                    <pre className="max-h-[520px] overflow-auto border-t border-[var(--ag-border)] p-4 text-[12px] leading-relaxed text-[var(--ag-text-2)] font-mono whitespace-pre-wrap">{diff.patch}</pre>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="p-4 text-[13px] text-[var(--ag-text-4)]">No application file changes detected in the worktree.</div>
            )}
          </div>

          <div className="ag-section-label mb-3">Artifacts</div>
          {artifacts.length === 0 ? (
            <div className="ag-card p-6 text-center">
              <p className="text-[13px] text-[var(--ag-text-4)]">No artifacts yet. Run the next stage to generate them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {artifacts.map((artifact, idx) => (
                <details key={artifact.name} className="ag-card group" open={idx === 0}>
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--ag-raised)] rounded-t-[var(--ag-radius)] transition-colors">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform group-open:rotate-90">
                        <path d="M5 3l4 4-4 4" stroke="var(--ag-text-4)" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[13px] font-medium text-[var(--ag-text-1)]">{artifact.name}</span>
                    </div>
                    <span className="text-[11px] text-[var(--ag-text-4)] font-mono">{Math.round(artifact.content.length / 1024)}KB</span>
                  </summary>
                  <div className="border-t border-[var(--ag-border)]">
                    <pre className="p-4 text-[12px] leading-relaxed text-[var(--ag-text-2)] font-mono whitespace-pre-wrap overflow-auto max-h-[500px]">{artifact.content}</pre>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — approvals + info */}
        <div className="space-y-4">
          {/* Approval history */}
          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Agent runs</div>
            {runs.length === 0 ? (
              <p className="text-[12px] text-[var(--ag-text-4)]">No runtime runs recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3" key={`${run.stage}-${run.startedAt}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-[var(--ag-text-1)] capitalize">{run.stage}</span>
                      <span className={run.status === "success" ? "text-[11px] text-[var(--ag-green)]" : "text-[11px] text-[var(--ag-red)]"}>{run.status}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px] text-[var(--ag-text-4)]">
                      <div>Runtime: <span className="font-mono text-[var(--ag-text-2)]">{run.runtimeId}</span></div>
                      <div>Role: <span className="font-mono text-[var(--ag-text-2)]">{run.role}</span></div>
                      <div className="break-all">Logs: <span className="font-mono text-[var(--ag-text-2)]">{run.logsPath}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Approvals</div>
            {approvals.length === 0 ? (
              <p className="text-[12px] text-[var(--ag-text-4)]">No approvals recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {approvals.map((a, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--ag-text-2)] capitalize">{a.stage}</span>
                    <span className={`text-[11px] font-medium ${a.status === "approved" ? "text-[var(--ag-green)]" : a.status === "rejected" ? "text-[var(--ag-red)]" : "text-[var(--ag-text-4)]"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task info */}
          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Details</div>
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="text-[var(--ag-text-4)]">Repository</div>
                <div className="text-[var(--ag-text-2)] mt-0.5">{task.repo}</div>
              </div>
              {task.worktree && (
                <div>
                  <div className="text-[var(--ag-text-4)]">Worktree</div>
                  <div className="text-[var(--ag-text-2)] mt-0.5 font-mono text-[11px] break-all">{task.worktree}</div>
                </div>
              )}
              <div>
                <div className="text-[var(--ag-text-4)]">Stage</div>
                <div className="text-[var(--ag-text-2)] mt-0.5 capitalize">{task.stage ?? "intake"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

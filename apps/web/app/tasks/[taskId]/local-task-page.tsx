import Link from "next/link";
import { getTaskDetail } from "../../data";
import { TaskActions } from "./task-actions";

/* ─── Pipeline stages ─── */
const STAGES = [
  { id: "requirements", label: "Reqs",     statuses: ["NEW", "CONTEXT_READY", "REQUIREMENTS_GENERATING", "WAITING_REQUIREMENTS_APPROVAL"] },
  { id: "design",       label: "Design",   statuses: ["DESIGN_GENERATING", "WAITING_DESIGN_APPROVAL"] },
  { id: "build",        label: "Build",    statuses: ["IMPLEMENTING", "TESTING", "REVIEWING", "FIXING"] },
  { id: "pr",           label: "PR",       statuses: ["PR_READY", "PR_OPENED", "WAITING_PR_APPROVAL"] },
  { id: "merge",        label: "Ship",     statuses: ["WAITING_MERGE_APPROVAL", "MERGED"] },
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

function statusLine(status: string): string {
  const map: Record<string, string> = {
    NEW: "Ready to start. Hit Run to generate requirements.",
    CONTEXT_READY: "Context loaded. Run to generate requirements.",
    REQUIREMENTS_GENERATING: "Agent is writing requirements...",
    WAITING_REQUIREMENTS_APPROVAL: "Requirements ready. Review and approve to continue.",
    DESIGN_GENERATING: "Agent is writing the design...",
    WAITING_DESIGN_APPROVAL: "Design ready. Review and approve to continue.",
    IMPLEMENTING: "Agent is writing code in a git worktree...",
    TESTING: "Running tests...",
    REVIEWING: "Code review in progress...",
    FIXING: "Agent is addressing review feedback...",
    PR_READY: "Code complete. Ready to open a pull request.",
    PR_OPENED: "Pull request opened.",
    WAITING_PR_APPROVAL: "PR ready for your approval.",
    WAITING_MERGE_APPROVAL: "Approved. Ready to merge.",
    MERGED: "Merged and shipped.",
    FAILED: "Something went wrong.",
    REJECTED: "Rejected.",
  };
  return map[status] ?? status;
}

function approvedStatusLine(status: string): string | null {
  const map: Record<string, string> = {
    WAITING_REQUIREMENTS_APPROVAL: "Requirements approved. Run design when ready.",
    WAITING_DESIGN_APPROVAL: "Design approved. Run implementation when ready.",
    WAITING_PR_APPROVAL: "PR approved. Open the pull request when ready.",
    WAITING_MERGE_APPROVAL: "Merge approved. Ship when ready.",
  };
  return map[status] ?? null;
}

function approvalStageForStatus(status: string): string | null {
  if (status === "WAITING_REQUIREMENTS_APPROVAL") return "requirements";
  if (status === "WAITING_DESIGN_APPROVAL") return "design";
  if (status === "WAITING_PR_APPROVAL") return "pr";
  if (status === "WAITING_MERGE_APPROVAL") return "merge";
  return null;
}

export function LocalTaskPage({ params }: { params: { taskId: string } }) {
  const { task, artifacts, approvals, diff, runs, runtimes } = getTaskDetail(Number(params.taskId));

  if (!task) {
    return (
      <div className="ag-card ag-empty">
        <div className="ag-empty-title">Task not found</div>
        <Link href="/" className="ag-btn ag-btn-ghost ag-btn-sm mt-4">Back</Link>
      </div>
    );
  }

  const isWaiting = task.status.includes("WAITING");
  const isTerminal = ["MERGED", "REJECTED"].includes(task.status);
  const canRun = ["NEW", "CONTEXT_READY", "FIXING"].includes(task.status);
  const approvalStage = approvalStageForStatus(task.status);
  const hasApprovalForStage = approvalStage
    ? approvals.some((approval) => approval.stage === approvalStage && approval.status === "approved")
    : false;
  const currentStatusLine = hasApprovalForStage ? approvedStatusLine(task.status) ?? statusLine(task.status) : statusLine(task.status);

  function pipelineClass(stageStatuses: string[]) {
    if (task!.status === "FAILED" || task!.status === "REJECTED") return "";
    const state = resolveStageState(stageStatuses, task!.status);
    if (state === "done") return "ag-pipeline-done";
    if (state === "current") return isWaiting ? "ag-pipeline-waiting" : "ag-pipeline-current";
    return "";
  }

  return (
    <div className="ag-animate-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="text-[12px] text-[var(--ag-text-4)] hover:text-[var(--ag-text-2)] transition-colors">Home</Link>
        <span className="text-[var(--ag-text-4)]">/</span>
        <span className="text-[12px] text-[var(--ag-text-2)] font-mono">#{task.id}</span>
      </div>

      {/* ═══ Header: title + action ═══ */}
      <div className={`ag-card p-6 mb-4 ${isWaiting ? "ag-card-glow-amber" : isTerminal ? "" : "ag-card-glow-blue"}`}>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] text-[var(--ag-text-4)]">TASK-{task.id}</span>
            <span className="text-[11px] text-[var(--ag-text-4)]">{task.repo}</span>
            {task.branch && <span className="text-[11px] text-[var(--ag-text-4)] font-mono">{task.branch}</span>}
          </div>
          <h1 className="text-[17px] font-semibold text-[var(--ag-text-1)] leading-snug">{task.title}</h1>
          {task.description && <p className="text-[13px] text-[var(--ag-text-3)] mt-1.5 max-w-[640px]">{task.description}</p>}
        </div>

        {/* Status + Action bar */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-[var(--ag-bg)] border border-[var(--ag-border)]">
          <div className="text-[13px] text-[var(--ag-text-2)]">{currentStatusLine}</div>
          <TaskActions
            taskId={task.id}
            status={task.status}
            approvalStage={approvalStage}
            hasApprovalForStage={hasApprovalForStage}
            canRun={canRun}
            isWaiting={isWaiting}
            isTerminal={isTerminal}
            runtimes={runtimes}
          />
        </div>

        {task.pr && (
          <div className="mt-3">
            <a href={task.pr} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--ag-blue)] hover:underline">
              View Pull Request
            </a>
          </div>
        )}
      </div>

      {/* ═══ Pipeline ═══ */}
      <div className="ag-pipeline mb-6">
        {STAGES.map((stage) => (
          <div key={stage.id} className={`ag-pipeline-stage ${pipelineClass(stage.statuses)}`}>
            {stage.label}
          </div>
        ))}
      </div>

      {/* ═══ Content: artifacts + diff ═══ */}
      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          {/* Diff preview */}
          {diff?.status && (
            <div className="ag-card">
              <div className="px-4 py-3 border-b border-[var(--ag-border)] flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--ag-text-1)]">Diff</span>
                <span className="ag-badge ag-badge-neutral ag-badge-sm">Changed</span>
              </div>
              <div className="p-4">
                <pre className="text-[12px] leading-relaxed text-[var(--ag-text-2)] font-mono whitespace-pre-wrap">{diff.status}</pre>
                {diff.stat && <pre className="mt-3 text-[12px] text-[var(--ag-text-3)] font-mono whitespace-pre-wrap">{diff.stat}</pre>}
              </div>
              {diff.patch && (
                <details>
                  <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-[var(--ag-text-3)] hover:text-[var(--ag-text-1)] border-t border-[var(--ag-border)]">
                    Full patch
                  </summary>
                  <pre className="max-h-[400px] overflow-auto border-t border-[var(--ag-border)] p-4 text-[12px] leading-relaxed text-[var(--ag-text-2)] font-mono whitespace-pre-wrap">{diff.patch}</pre>
                </details>
              )}
            </div>
          )}

          {/* Artifacts */}
          {artifacts.length > 0 && (
            <div className="space-y-3">
              <div className="ag-section-label px-1">Artifacts</div>
              {artifacts.map((artifact, idx) => (
                <details key={artifact.name} className="ag-card group" open={idx === 0}>
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--ag-raised)] rounded-t-[var(--ag-radius)] transition-colors">
                    <div className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform group-open:rotate-90">
                        <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="var(--ag-text-4)" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[13px] font-medium text-[var(--ag-text-1)]">{artifact.name}</span>
                    </div>
                    <span className="text-[11px] text-[var(--ag-text-4)] font-mono">{Math.round(artifact.content.length / 1024)}KB</span>
                  </summary>
                  <div className="border-t border-[var(--ag-border)]">
                    <pre className="p-4 text-[12px] leading-relaxed text-[var(--ag-text-2)] font-mono whitespace-pre-wrap overflow-auto max-h-[480px]">{artifact.content}</pre>
                  </div>
                </details>
              ))}
            </div>
          )}

          {artifacts.length === 0 && !diff?.status && (
            <div className="ag-card p-8 text-center">
              <p className="text-[13px] text-[var(--ag-text-4)]">No artifacts yet. Run the next stage to generate them.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {runs.length > 0 && (
            <div className="ag-card p-4">
              <div className="ag-section-label mb-3">CLI Runs</div>
              <div className="space-y-2.5">
                {runs.map((run) => (
                  <details key={`${run.stage}-${run.startedAt}`} className="p-2.5 rounded-md bg-[var(--ag-bg)] border border-[var(--ag-border)] group">
                    <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-[var(--ag-text-1)] capitalize">{run.stage}</span>
                      <span className={`text-[10px] font-medium ${run.status === "success" ? "text-[var(--ag-green)]" : "text-[var(--ag-red)]"}`}>{run.status}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-[var(--ag-text-4)] font-mono">{run.runtimeId}</div>
                    {run.error && <div className="mt-1.5 text-[11px] text-[var(--ag-red)]">{run.error}</div>}
                    {run.stderr && !run.error && <div className="mt-1.5 text-[11px] text-[var(--ag-amber)]">stderr captured</div>}
                    </summary>
                    <div className="mt-2 space-y-2 border-t border-[var(--ag-border)] pt-2">
                      {run.stdout && (
                        <div>
                          <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">stdout</div>
                          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded bg-[var(--ag-raised)] p-2 text-[10px] leading-relaxed text-[var(--ag-text-2)]">{run.stdout}</pre>
                        </div>
                      )}
                      {run.stderr && (
                        <div>
                          <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">stderr</div>
                          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded bg-[var(--ag-raised)] p-2 text-[10px] leading-relaxed text-[var(--ag-red)]">{run.stderr}</pre>
                        </div>
                      )}
                      {run.prompt && (
                        <details>
                          <summary className="cursor-pointer text-[11px] text-[var(--ag-text-3)]">Prompt sent to CLI</summary>
                          <pre className="mt-1 max-h-[220px] overflow-auto whitespace-pre-wrap rounded bg-[var(--ag-raised)] p-2 text-[10px] leading-relaxed text-[var(--ag-text-2)]">{run.prompt}</pre>
                        </details>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {approvals.length > 0 && (
            <div className="ag-card p-4">
              <div className="ag-section-label mb-3">Approvals</div>
              <div className="space-y-2">
                {approvals.map((a, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--ag-text-2)] capitalize">{a.stage}</span>
                    <span className={`text-[11px] font-medium ${a.status === "approved" ? "text-[var(--ag-green)]" : a.status === "rejected" ? "text-[var(--ag-red)]" : "text-[var(--ag-text-4)]"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Details</div>
            <div className="space-y-2.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[var(--ag-text-4)]">Repo</span>
                <span className="text-[var(--ag-text-2)]">{task.repo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ag-text-4)]">Stage</span>
                <span className="text-[var(--ag-text-2)] capitalize">{task.stage ?? "intake"}</span>
              </div>
              {task.worktree && (
                <div>
                  <span className="text-[var(--ag-text-4)]">Worktree</span>
                  <div className="text-[var(--ag-text-3)] font-mono text-[10px] mt-0.5 break-all">{task.worktree}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

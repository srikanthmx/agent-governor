"use client";

import { useMemo, useState } from "react";

type Task = {
  id: number;
  title: string;
  repo: string;
  status: string;
  stage: string | null;
  runtime: string;
  pr: string | null;
};

type Repo = {
  id: number;
  name: string;
  github: string;
};

type Runtime = {
  id: string;
  type: string;
  enabled: boolean;
};

type Approval = {
  taskId: number;
  stage: string;
  status: string;
};

const stages = [
  { id: "intake", label: "Intake", detail: "Ideas and repo context" },
  { id: "requirements", label: "Requirements", detail: "Owner-approved scope" },
  { id: "design", label: "Design", detail: "Owner-approved plan" },
  { id: "execution", label: "Execution", detail: "Runtime in worktree" },
  { id: "pull-request", label: "Pull Request", detail: "Branch review and merge" }
];

function stageForStatus(status: string) {
  if (status.includes("REQUIREMENTS")) return "requirements";
  if (status.includes("DESIGN")) return "design";
  if (["IMPLEMENTING", "TESTING", "REVIEWING", "FIXING"].includes(status)) return "execution";
  if (status.includes("PR") || status.includes("MERGE") || status === "MERGED") return "pull-request";
  return "intake";
}

function statusAccent(status: string) {
  if (status.includes("WAITING")) return "bg-[var(--ag-amber)]";
  if (status === "FAILED" || status === "REJECTED") return "bg-[var(--ag-coral)]";
  if (status === "FIXING") return "bg-[var(--ag-cyan)]";
  if (status === "MERGED" || status === "PR_OPENED") return "bg-[var(--ag-green)]";
  return "bg-[var(--ag-violet)]";
}

export function OrchestrationCanvas({
  tasks,
  repos,
  runtimes,
  approvals
}: {
  tasks: Task[];
  repos: Repo[];
  runtimes: Runtime[];
  approvals: Approval[];
}) {
  const [selectedStage, setSelectedStage] = useState("execution");
  const summary = useMemo(() => {
    const pendingApprovals = approvals.filter((approval) => approval.status !== "APPROVED").length;
    const enabledRuntimes = runtimes.filter((runtime) => runtime.enabled);
    const grouped = stages.map((stage) => ({
      ...stage,
      tasks: tasks.filter((task) => stageForStatus(task.status) === stage.id)
    }));

    return {
      grouped,
      pendingApprovals,
      enabledRuntimes,
      activeRuntime: enabledRuntimes[0]?.id ?? "none",
      prTasks: tasks.filter((task) => task.pr || task.status.includes("PR") || task.status.includes("MERGE")).length
    };
  }, [approvals, runtimes, tasks]);

  const selected = summary.grouped.find((stage) => stage.id === selectedStage) ?? summary.grouped[0];
  const nextTasks = selected.tasks.slice(0, 4);

  return (
    <section className="ag-panel rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ag-line)] px-4 py-3">
        <div>
          <div className="ag-kicker text-xs uppercase">[ orchestration ]</div>
          <h2 className="mt-1 text-sm ag-section-title">Governed Work Flow</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <MiniStat label="Repos" value={repos.length} />
          <MiniStat label="Gates" value={summary.pendingApprovals} />
          <MiniStat label="PRs" value={summary.prTasks} />
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-2">
          {summary.grouped.map((stage, index) => {
            const active = stage.id === selected.id;
            return (
              <button
                className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-md border px-3 py-3 text-left ${
                  active
                    ? "border-[var(--ag-cyan)] bg-[color-mix(in_srgb,var(--ag-cyan)_12%,transparent)]"
                    : "border-[var(--ag-line)] bg-[var(--ag-surface)] hover:border-[var(--ag-line-strong)]"
                }`}
                key={stage.id}
                onClick={() => setSelectedStage(stage.id)}
                type="button"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ag-line)] bg-[var(--ag-panel-2)] font-mono text-xs text-[var(--ag-muted)]">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-[var(--ag-heading)]">{stage.label}</div>
                    {stage.tasks.length ? <span className="rounded bg-[var(--ag-panel-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ag-muted)]">{stage.tasks.length}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ag-muted)]">{stage.detail}</div>
                </div>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--ag-panel-2)]">
                  <div className="h-full rounded-full bg-[var(--ag-cyan)]" style={{ width: `${Math.min(100, stage.tasks.length * 34)}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        <aside className="rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] p-3">
          <div className="text-sm font-semibold text-[var(--ag-heading)]">{selected.label}</div>
          <div className="mt-1 text-xs text-[var(--ag-muted)]">{selected.detail}</div>
          <div className="mt-4 grid gap-2">
            {nextTasks.map((task) => (
              <div className="rounded-md border border-[var(--ag-line)] bg-[var(--ag-panel)] p-2" key={task.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-[var(--ag-muted)]">TASK-{task.id}</span>
                  <span className={`h-2 w-2 rounded-full ${statusAccent(task.status)}`} />
                </div>
                <div className="mt-1 truncate text-sm font-medium text-[var(--ag-heading)]">{task.title}</div>
                <div className="mt-1 truncate text-xs text-[var(--ag-muted)]">{task.repo} / {task.status}</div>
              </div>
            ))}
            {nextTasks.length === 0 ? <div className="rounded-md border border-dashed border-[var(--ag-line)] p-3 text-xs text-[var(--ag-muted)]">No tasks in this stage.</div> : null}
          </div>
          <div className="mt-4 border-t border-[var(--ag-line)] pt-3">
            <div className="font-mono text-[10px] uppercase text-[var(--ag-muted)]">Runtime route</div>
            <div className="mt-1 text-sm font-semibold text-[var(--ag-heading)]">{summary.activeRuntime}</div>
            <div className="mt-1 text-xs text-[var(--ag-muted)]">{summary.enabledRuntimes.length}/{runtimes.length} adapters enabled</div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase text-[var(--ag-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--ag-heading)]">{value}</div>
    </div>
  );
}

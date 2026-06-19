import Link from "next/link";
import { buildTaskProgressSnapshot } from "../../api/tasks/_timeline";
import { TaskProgressStream } from "./task-progress-stream";

function badgeForStatus(status: string | null | undefined) {
  if (!status) return "ag-badge-muted";
  if (status === "PR_OPENED" || status === "MERGED") return "ag-badge-success";
  if (status === "FAILED" || status === "REJECTED") return "ag-badge-danger";
  if (status.includes("WAITING")) return "ag-badge-waiting";
  return "ag-badge-active";
}

export function ControlPlaneTaskRoom({ taskId }: { taskId: string }) {
  const numericTaskId = Number(taskId.replace(/^TASK-/i, ""));
  const snapshot = Number.isFinite(numericTaskId)
    ? buildTaskProgressSnapshot(numericTaskId)
    : null;
  const task = snapshot?.task ?? null;

  if (!snapshot?.ok || !task) {
    return (
      <div className="ag-card p-6">
        <div className="mb-2 text-[14px] font-medium text-[var(--ag-text-1)]">Task not found</div>
        <Link href="/" className="text-[12px] text-[var(--ag-blue)]">Back to control plane</Link>
      </div>
    );
  }

  return (
    <div className="ag-animate-in">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-[12px] text-[var(--ag-text-4)] hover:text-[var(--ag-text-2)]">Control Plane</Link>
          <span className="text-[var(--ag-text-4)]">/</span>
          <span className="font-mono text-[12px] text-[var(--ag-text-2)]">TASK-{task.id}</span>
        </div>
        <span className="ag-badge ag-badge-active">live room</span>
      </div>

      <div className="ag-card ag-card-glow-blue mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-[var(--ag-text-4)]">TASK-{task.id}</span>
              <span className={`ag-badge ${badgeForStatus(task.status)}`}>{task.status}</span>
              <span className="ag-badge ag-badge-neutral">{task.repo}</span>
              {task.stage && <span className="ag-badge ag-badge-muted">{task.stage}</span>}
            </div>
            <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)]">{task.title}</h1>
            <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ag-text-3)]">{task.description}</p>
          </div>
          {task.prUrl ? (
            <a className="ag-btn ag-btn-primary" href={task.prUrl}>Open PR</a>
          ) : (
            <span className="ag-badge ag-badge-muted">PR pending</span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Meta label="Next Action" value={snapshot.nextAction.label} tone={snapshot.nextAction.type === "approval_required" ? "warn" : "good"} />
          <Meta label="Branch" value={task.branch ?? "pending"} />
          <Meta label="Updated" value={new Date(task.updatedAt).toLocaleString()} />
          <Meta label="Events" value={String(snapshot.events.length)} />
        </div>
      </div>

      <TaskProgressStream taskId={task.id} initialSnapshot={{ ...snapshot, task }} />
    </div>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-[var(--ag-green)]" : tone === "warn" ? "text-[var(--ag-amber)]" : "text-[var(--ag-text-1)]";
  return (
    <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
      <div className="text-[11px] text-[var(--ag-text-4)]">{label}</div>
      <div className={`mt-1 truncate text-[13px] font-medium ${color}`}>{value}</div>
    </div>
  );
}

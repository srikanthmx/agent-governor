import Link from "next/link";
import { RunTaskButton } from "../../dashboard-actions";
import { getTaskDetail } from "../../data";

export default function TaskPage({ params }: { params: { taskId: string } }) {
  const { task, artifacts, approvals, runtimes } = getTaskDetail(Number(params.taskId));

  if (!task) {
    return (
      <main className="min-h-screen px-6 py-6">
        <Link className="text-sm text-zinc-400" href="/">Back</Link>
        <p className="mt-6 text-sm text-zinc-500">Task not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Link className="text-xs text-zinc-500" href="/">Dashboard</Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">TASK-{task.id}: {task.title}</h1>
              <p className="mt-1 text-sm text-zinc-400">{task.repo} / {task.status} / {task.stage ?? "none"}</p>
            </div>
            <div className="font-mono text-xs text-zinc-500">{task.branch ?? "no branch"}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-200">{task.description}</p>
          </div>

          {artifacts.map((artifact) => (
            <section className="rounded-md border border-zinc-800" key={artifact.name}>
              <div className="border-b border-zinc-800 px-4 py-2">
                <h2 className="font-mono text-xs text-zinc-400">{artifact.name}</h2>
              </div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap p-4 text-sm leading-6 text-zinc-200">{artifact.content}</pre>
            </section>
          ))}
          {artifacts.length === 0 ? <p className="text-sm text-zinc-500">No artifacts found for this task.</p> : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Execution</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-zinc-500">Worktree</dt><dd className="break-all font-mono text-xs">{task.worktree ?? "none"}</dd></div>
              <div><dt className="text-zinc-500">PR</dt><dd className="break-all">{task.pr ?? "none"}</dd></div>
            </dl>
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <RunTaskButton taskId={task.id} runtimes={runtimes} />
            </div>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Approvals</h2>
            <div className="space-y-3 text-sm">
              {approvals.map((approval) => (
                <div key={`${approval.stage}-${approval.createdAt}`} className="flex justify-between gap-3">
                  <span>{approval.stage}</span>
                  <span className={approval.status === "approved" ? "text-emerald-400" : "text-zinc-500"}>{approval.status}</span>
                </div>
              ))}
              {approvals.length === 0 ? <p className="text-zinc-500">No approvals recorded</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

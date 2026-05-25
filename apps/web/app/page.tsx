import { getDashboardData } from "./data";

export default function Page() {
  const { tasks, approvals, runtimes, repos } = getDashboardData();

  return (
    <main className="min-h-screen">
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-normal">Agent Governor</h1>
            <p className="text-xs text-zinc-400">Local control plane for PR-first agent work</p>
          </div>
          <button className="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-200">Command</button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-5 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-zinc-400">Tasks</h2>
            <button className="h-8 rounded-md bg-zinc-100 px-3 text-sm text-zinc-950">New Task</button>
          </div>
          <div className="overflow-hidden rounded-md border border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Task</th>
                  <th className="px-3 py-2">Repo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Runtime</th>
                  <th className="px-3 py-2">PR</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-mono text-xs">TASK-{task.id}</td>
                    <td className="px-3 py-2">{task.repo}</td>
                    <td className="px-3 py-2">{task.status}</td>
                    <td className="px-3 py-2">{task.stage ?? "none"}</td>
                    <td className="px-3 py-2">{task.runtime}</td>
                    <td className="px-3 py-2 text-zinc-500">{task.pr || "none"}</td>
                  </tr>
                ))}
                {tasks.length === 0 ? (
                  <tr className="border-t border-zinc-800">
                    <td className="px-3 py-6 text-zinc-500" colSpan={6}>No tasks yet</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Approvals</h2>
            <div className="space-y-2">
              {approvals.map((approval) => (
                <div key={`${approval.taskId}-${approval.stage}-${approval.status}`} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">TASK-{approval.taskId}</span>
                  <span>{approval.stage}</span>
                  <span className={approval.status === "approved" ? "text-emerald-400" : "text-zinc-500"}>{approval.status}</span>
                </div>
              ))}
              {approvals.length === 0 ? <p className="text-sm text-zinc-500">No approvals recorded</p> : null}
            </div>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Runtime Health</h2>
            <div className="grid gap-2 text-sm">
              {runtimes.map((runtime) => (
                <div className="flex justify-between" key={runtime.id}>
                  <span>{runtime.id}</span>
                  <span className={runtime.enabled ? "text-emerald-400" : "text-zinc-500"}>{runtime.enabled ? "enabled" : "disabled"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Repos</h2>
            <div className="grid gap-2 text-sm">
              {repos.map((repo) => (
                <div className="flex justify-between gap-3" key={repo.id}>
                  <span>{repo.name}</span>
                  <span className="truncate text-zinc-500">{repo.github}</span>
                </div>
              ))}
              {repos.length === 0 ? <p className="text-sm text-zinc-500">No repos registered</p> : null}
            </div>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Live Logs</h2>
            <pre className="h-40 overflow-auto rounded bg-black p-3 text-xs text-zinc-400">sqlite ready{"\n"}workflow runner ready{"\n"}runtime router ready</pre>
          </section>
        </aside>
      </div>
    </main>
  );
}

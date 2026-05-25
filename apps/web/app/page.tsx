const tasks = [
  { id: "TASK-001", repo: "agent-governor", status: "NEW", stage: "intake", runtime: "shell", pr: "" },
  { id: "TASK-002", repo: "example-app", status: "WAITING_REQUIREMENTS_APPROVAL", stage: "requirements", runtime: "opencode", pr: "" }
];

const approvals = [
  { task: "TASK-002", gate: "requirements", owner: "pending" },
  { task: "TASK-004", gate: "pr", owner: "pending" }
];

export default function Page() {
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
                    <td className="px-3 py-2 font-mono text-xs">{task.id}</td>
                    <td className="px-3 py-2">{task.repo}</td>
                    <td className="px-3 py-2">{task.status}</td>
                    <td className="px-3 py-2">{task.stage}</td>
                    <td className="px-3 py-2">{task.runtime}</td>
                    <td className="px-3 py-2 text-zinc-500">{task.pr || "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Pending Approvals</h2>
            <div className="space-y-2">
              {approvals.map((approval) => (
                <div key={`${approval.task}-${approval.gate}`} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{approval.task}</span>
                  <span>{approval.gate}</span>
                  <button className="h-7 rounded-md border border-zinc-700 px-2 text-xs">Approve</button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Runtime Health</h2>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span>shell</span><span className="text-emerald-400">ready</span></div>
              <div className="flex justify-between"><span>opencode</span><span className="text-zinc-500">optional</span></div>
              <div className="flex justify-between"><span>aider</span><span className="text-zinc-500">placeholder</span></div>
            </div>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">Live Logs</h2>
            <pre className="h-40 overflow-auto rounded bg-black p-3 text-xs text-zinc-400">worker idle{"\n"}telegram bot disconnected{"\n"}sqlite ready</pre>
          </section>
        </aside>
      </div>
    </main>
  );
}

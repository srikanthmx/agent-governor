import Link from "next/link";
import { CreateTaskPanel, RepoWorkbench } from "./dashboard-actions";
import { getDashboardData } from "./data";

function statusTone(status: string) {
  if (status.includes("WAITING")) return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "FAILED" || status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "MERGED" || status === "PR_OPENED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

function nextAction(status: string) {
  if (status === "NEW") return "Run requirements";
  if (status === "WAITING_REQUIREMENTS_APPROVAL") return "Approve requirements";
  if (status === "WAITING_DESIGN_APPROVAL") return "Approve design";
  if (status === "WAITING_PR_APPROVAL") return "Approve PR";
  if (status === "PR_OPENED") return "Approve merge";
  if (status === "FIXING") return "Review requested changes";
  if (status === "FAILED") return "Inspect logs";
  return "Inspect task";
}

const workflowStages = ["Idea", "Requirements", "Design", "Implement", "PR", "Merge"];

export default function Page() {
  const { tasks, approvals, runtimes, repos, githubRepos } = getDashboardData();
  const pendingApprovals = tasks.filter((task) => task.status.includes("WAITING")).length;
  const enabledRuntimes = runtimes.filter((runtime) => runtime.enabled).length;

  return (
    <main className="min-h-screen bg-[#090b0f] text-zinc-100">
      <div className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-3">
          <div>
            <h1 className="text-base font-semibold">Agent Governor</h1>
            <p className="text-xs text-zinc-500">Local governance for GitHub-first agent work</p>
          </div>
          <nav className="flex items-center gap-2">
            <Link className="h-9 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" href="/settings/github">GitHub</Link>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-5 py-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-xs uppercase text-zinc-500">Managed Repos</div>
            <div className="mt-2 text-2xl font-semibold">{repos.length}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-xs uppercase text-zinc-500">GitHub Synced</div>
            <div className="mt-2 text-2xl font-semibold">{githubRepos.length}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-xs uppercase text-zinc-500">Open Tasks</div>
            <div className="mt-2 text-2xl font-semibold">{tasks.length}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-xs uppercase text-zinc-500">Approval Gates</div>
            <div className="mt-2 text-2xl font-semibold">{pendingApprovals}</div>
          </div>
        </section>

        <section className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase text-zinc-300">Governed Delivery Flow</h2>
              <p className="mt-1 text-xs text-zinc-500">Every task moves through owner-gated artifacts before PR and merge.</p>
            </div>
            <div className="font-mono text-xs text-zinc-500">local-first / worktree-isolated / PR-first</div>
          </div>
          <div className="grid gap-2 md:grid-cols-6">
            {workflowStages.map((stage, index) => (
              <div className="rounded-md border border-zinc-800 bg-black px-3 py-3" key={stage}>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-zinc-500">0{index + 1}</span>
                  <span className={index === 0 ? "text-emerald-400" : index < 4 ? "text-amber-300" : "text-zinc-500"}>{index < 4 ? "active" : "gated"}</span>
                </div>
                <div className="mt-2 text-sm font-medium">{stage}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <section className="space-y-4">
            <CreateTaskPanel repos={repos} />

            <section className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/40">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase text-zinc-300">Task Queue</h2>
                  <p className="mt-1 text-xs text-zinc-500">Click a task to inspect requirements, design, logs, and approvals.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Repo</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Next</th>
                    <th className="px-3 py-2">Runtime</th>
                    <th className="px-3 py-2">PR</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-zinc-800 hover:bg-zinc-900/60">
                      <td className="px-3 py-3 font-mono text-xs">
                        <Link className="text-zinc-100 underline decoration-zinc-700 underline-offset-4" href={`/tasks/${task.id}`}>TASK-{task.id}</Link>
                      </td>
                      <td className="max-w-[260px] px-3 py-3">
                        <div className="truncate font-medium">{task.title}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{task.description}</div>
                      </td>
                      <td className="px-3 py-3">{task.repo}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded border px-2 py-1 text-xs ${statusTone(task.status)}`}>{task.status}</span>
                      </td>
                      <td className="px-3 py-3">{task.stage ?? "none"}</td>
                      <td className="px-3 py-3 text-zinc-300">{nextAction(task.status)}</td>
                      <td className="px-3 py-3">{task.runtime}</td>
                      <td className="px-3 py-3 text-zinc-500">{task.pr || "none"}</td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? (
                    <tr className="border-t border-zinc-800">
                      <td className="px-3 py-8 text-zinc-500" colSpan={8}>Create a task from a managed repo to start the governed workflow.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              </div>
            </section>

            <RepoWorkbench githubRepos={githubRepos} managedRepos={repos} />
          </section>

          <aside className="space-y-4">
            <section className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
              <h2 className="text-sm font-semibold uppercase text-zinc-300">Action Center</h2>
              <div className="mt-3 space-y-2">
                {tasks.slice(0, 4).map((task) => (
                  <Link className="block rounded-md border border-zinc-800 bg-black px-3 py-2 hover:bg-zinc-900" href={`/tasks/${task.id}`} key={task.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono text-xs">TASK-{task.id}</span>
                      <span className="text-xs text-zinc-400">{nextAction(task.status)}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{task.title}</div>
                  </Link>
                ))}
                {tasks.length === 0 ? <p className="text-sm text-zinc-500">No active actions yet.</p> : null}
              </div>
            </section>

            <section className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
              <h2 className="text-sm font-semibold uppercase text-zinc-300">Runtime Router</h2>
              <p className="mt-1 text-xs text-zinc-500">{enabledRuntimes} enabled. Disabled runtimes are placeholders until enabled in `config/agents.yml`.</p>
              <div className="mt-4 space-y-2">
                {runtimes.map((runtime) => (
                  <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm" key={runtime.id}>
                    <div>
                      <div>{runtime.id}</div>
                      <div className="text-xs text-zinc-500">{runtime.type}</div>
                    </div>
                    <span className={runtime.enabled ? "text-emerald-400" : "text-zinc-500"}>{runtime.enabled ? "enabled" : "disabled"}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
              <h2 className="text-sm font-semibold uppercase text-zinc-300">Managed Repos</h2>
              <div className="mt-3 space-y-2 text-sm">
                {repos.map((repo) => (
                  <div className="rounded-md border border-zinc-800 bg-black px-3 py-2" key={repo.id}>
                    <div>{repo.name}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{repo.github}</div>
                  </div>
                ))}
                {repos.length === 0 ? <p className="text-sm text-zinc-500">Clone from GitHub or link a local repo.</p> : null}
              </div>
            </section>

            <section className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
              <h2 className="text-sm font-semibold uppercase text-zinc-300">Approvals</h2>
              <div className="mt-3 space-y-2">
                {approvals.map((approval) => (
                  <div key={`${approval.taskId}-${approval.stage}-${approval.status}`} className="flex items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
                    <span className="font-mono text-xs">TASK-{approval.taskId}</span>
                    <span>{approval.stage}</span>
                    <span className={approval.status === "approved" ? "text-emerald-400" : "text-zinc-500"}>{approval.status}</span>
                  </div>
                ))}
                {approvals.length === 0 ? <p className="text-sm text-zinc-500">No approvals recorded.</p> : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

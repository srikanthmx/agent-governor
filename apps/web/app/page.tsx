import Link from "next/link";
import { CreateTaskPanel, RepoWorkbench } from "./dashboard-actions";
import { getDashboardData } from "./data";

function statusTone(status: string) {
  if (status.includes("WAITING")) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (status === "FAILED" || status === "REJECTED") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (status === "MERGED" || status === "PR_OPENED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (status === "FIXING") return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

function nextAction(status: string) {
  if (status === "NEW") return "Generate requirements";
  if (status === "WAITING_REQUIREMENTS_APPROVAL") return "Approve requirements";
  if (status === "WAITING_DESIGN_APPROVAL") return "Approve design";
  if (status === "WAITING_PR_APPROVAL") return "Approve PR";
  if (status === "PR_OPENED") return "Approve merge";
  if (status === "FIXING") return "Review changes";
  if (status === "FAILED") return "Inspect failure";
  return "Inspect";
}

function stageBucket(status: string) {
  if (status === "NEW" || status === "CONTEXT_READY") return "Intake";
  if (status.includes("WAITING")) return "Approval";
  if (["IMPLEMENTING", "TESTING", "REVIEWING", "FIXING"].includes(status)) return "Execution";
  if (["PR_READY", "PR_OPENED", "WAITING_MERGE_APPROVAL", "MERGED"].includes(status)) return "PR";
  return "Other";
}

const flow = [
  ["Idea", "Task captured"],
  ["Requirements", "Owner-gated"],
  ["Design", "Owner-gated"],
  ["Implementation", "Worktree"],
  ["Pull Request", "Owner-gated"],
  ["Merge", "Owner-gated"]
];

const buckets = ["Intake", "Approval", "Execution", "PR"];

export default function Page() {
  const { tasks, approvals, runtimes, repos, githubRepos } = getDashboardData();
  const pendingApprovals = tasks.filter((task) => task.status.includes("WAITING")).length;
  const enabledRuntimes = runtimes.filter((runtime) => runtime.enabled).length;
  const actionTasks = [...tasks].sort((a, b) => {
    const aWaiting = a.status.includes("WAITING") ? 0 : 1;
    const bWaiting = b.status.includes("WAITING") ? 0 : 1;
    return aWaiting - bWaiting || b.id - a.id;
  });

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-zinc-800 bg-black lg:block">
          <div className="border-b border-zinc-800 px-5 py-5">
            <div className="text-sm font-semibold">Agent Governor</div>
            <div className="mt-1 text-xs text-zinc-500">Local control plane</div>
          </div>
          <nav className="space-y-1 px-3 py-4 text-sm">
            {["Command", "Tasks", "Repos", "Approvals", "Runtimes"].map((item) => (
              <div className={item === "Command" ? "rounded-md bg-zinc-900 px-3 py-2 text-zinc-100" : "rounded-md px-3 py-2 text-zinc-500"} key={item}>
                {item}
              </div>
            ))}
          </nav>
          <div className="absolute bottom-0 hidden w-[239px] border-t border-zinc-800 p-4 lg:block">
            <div className="text-xs uppercase text-zinc-500">Mode</div>
            <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">Local-first</div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#08090d]/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <h1 className="text-xl font-semibold">Command Center</h1>
                <p className="text-sm text-zinc-500">Govern repos, approvals, runtimes, and PR flow from this machine.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden h-9 w-72 items-center rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-500 md:flex">Search tasks, repos, runs</div>
                <Link className="h-9 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" href="/settings/github">GitHub</Link>
              </div>
            </div>
          </header>

          <div className="px-5 py-5">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Managed repos" value={repos.length} accent="emerald" />
              <Metric label="GitHub synced" value={githubRepos.length} accent="sky" />
              <Metric label="Open tasks" value={tasks.length} accent="violet" />
              <Metric label="Approval gates" value={pendingApprovals} accent="amber" />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
              <div className="space-y-4">
                <section className="rounded-md border border-zinc-800 bg-zinc-950/50">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold uppercase text-zinc-300">Delivery Pipeline</h2>
                      <p className="mt-1 text-xs text-zinc-500">Each task produces artifacts before implementation, PR, and merge.</p>
                    </div>
                    <div className="font-mono text-xs text-zinc-500">worktree isolated / owner approved</div>
                  </div>
                  <div className="grid gap-px bg-zinc-800 p-px md:grid-cols-6">
                    {flow.map(([name, detail], index) => (
                      <div className="bg-black p-4" key={name}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-zinc-500">0{index + 1}</span>
                          <span className={index < 4 ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>{index < 4 ? "ready" : "gated"}</span>
                        </div>
                        <div className="mt-3 text-sm font-medium">{name}</div>
                        <div className="mt-1 text-xs text-zinc-500">{detail}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-3 xl:grid-cols-4">
                  {buckets.map((bucket) => {
                    const bucketTasks = tasks.filter((task) => stageBucket(task.status) === bucket);
                    return (
                      <div className="rounded-md border border-zinc-800 bg-zinc-950/50" key={bucket}>
                        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                          <h3 className="text-xs font-semibold uppercase text-zinc-400">{bucket}</h3>
                          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">{bucketTasks.length}</span>
                        </div>
                        <div className="min-h-40 space-y-2 p-2">
                          {bucketTasks.map((task) => (
                            <Link className="block rounded-md border border-zinc-800 bg-black p-3 hover:border-zinc-600" href={`/tasks/${task.id}`} key={task.id}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs text-zinc-400">TASK-{task.id}</span>
                                <span className={`rounded border px-1.5 py-0.5 text-[11px] ${statusTone(task.status)}`}>{task.status}</span>
                              </div>
                              <div className="mt-2 truncate text-sm font-medium">{task.title}</div>
                              <div className="mt-1 truncate text-xs text-zinc-500">{task.repo}</div>
                            </Link>
                          ))}
                          {bucketTasks.length === 0 ? <div className="p-3 text-xs text-zinc-600">Empty</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/50">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <h2 className="text-sm font-semibold uppercase text-zinc-300">Task Ledger</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse text-sm">
                      <thead className="bg-zinc-900 text-left text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-3 py-2">Task</th>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Repo</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Next</th>
                          <th className="px-3 py-2">Runtime</th>
                          <th className="px-3 py-2">PR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr className="border-t border-zinc-800 hover:bg-zinc-900/60" key={task.id}>
                            <td className="px-3 py-3 font-mono text-xs"><Link className="underline decoration-zinc-700 underline-offset-4" href={`/tasks/${task.id}`}>TASK-{task.id}</Link></td>
                            <td className="max-w-[320px] px-3 py-3"><div className="truncate font-medium">{task.title}</div><div className="mt-1 truncate text-xs text-zinc-500">{task.description}</div></td>
                            <td className="px-3 py-3">{task.repo}</td>
                            <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs ${statusTone(task.status)}`}>{task.status}</span></td>
                            <td className="px-3 py-3 text-zinc-300">{nextAction(task.status)}</td>
                            <td className="px-3 py-3">{task.runtime}</td>
                            <td className="px-3 py-3 text-zinc-500">{task.pr || "none"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <RepoWorkbench githubRepos={githubRepos} managedRepos={repos} />
              </div>

              <aside className="space-y-4">
                <CreateTaskPanel repos={repos} />

                <section className="rounded-md border border-zinc-800 bg-zinc-950/50 p-4">
                  <h2 className="text-sm font-semibold uppercase text-zinc-300">Next Actions</h2>
                  <div className="mt-3 space-y-2">
                    {actionTasks.slice(0, 5).map((task) => (
                      <Link className="block rounded-md border border-zinc-800 bg-black px-3 py-2 hover:bg-zinc-900" href={`/tasks/${task.id}`} key={task.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-zinc-400">TASK-{task.id}</span>
                          <span className="text-xs text-zinc-300">{nextAction(task.status)}</span>
                        </div>
                        <div className="mt-1 truncate text-sm">{task.title}</div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-zinc-800 bg-zinc-950/50 p-4">
                  <h2 className="text-sm font-semibold uppercase text-zinc-300">Runtime Router</h2>
                  <p className="mt-1 text-xs text-zinc-500">{enabledRuntimes} enabled. Runtime availability comes from config.</p>
                  <div className="mt-4 grid gap-2">
                    {runtimes.map((runtime) => (
                      <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm" key={runtime.id}>
                        <div><div>{runtime.id}</div><div className="text-xs text-zinc-500">{runtime.type}</div></div>
                        <span className={runtime.enabled ? "text-emerald-400" : "text-zinc-500"}>{runtime.enabled ? "enabled" : "disabled"}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-zinc-800 bg-zinc-950/50 p-4">
                  <h2 className="text-sm font-semibold uppercase text-zinc-300">Managed Repos</h2>
                  <div className="mt-3 space-y-2">
                    {repos.map((repo) => (
                      <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm" key={repo.id}>
                        <div>{repo.name}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{repo.github}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent: "emerald" | "sky" | "violet" | "amber" }) {
  const tones = {
    emerald: "border-l-emerald-400",
    sky: "border-l-sky-400",
    violet: "border-l-violet-400",
    amber: "border-l-amber-300"
  };
  return (
    <div className={`rounded-md border border-l-4 border-zinc-800 ${tones[accent]} bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

import Link from "next/link";
import { CreateTaskPanel, RepoWorkbench } from "./dashboard-actions";
import { getDashboardData } from "./data";
import { OrchestrationCanvas } from "./orchestration-canvas";

function statusTone(status: string) {
  if (status.includes("WAITING")) return "border-[#ffca58]/45 bg-[#ffca58]/12 text-[#ffe1a0]";
  if (status === "FAILED" || status === "REJECTED") return "border-[#ff715b]/45 bg-[#ff715b]/12 text-[#ffb4a8]";
  if (status === "MERGED" || status === "PR_OPENED") return "border-[#b8ff65]/45 bg-[#b8ff65]/12 text-[#d6ff9f]";
  if (status === "FIXING") return "border-[#6bdcff]/45 bg-[#6bdcff]/12 text-[#b5edff]";
  return "border-[#596044] bg-[#202316] text-[#f4f0df]";
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

const commands = [
  { label: "/idea", detail: "Capture work", key: "01" },
  { label: "/approve", detail: "Release gate", key: "02" },
  { label: "/pr", detail: "Open branch PR", key: "03" },
  { label: "/merge", detail: "Owner only", key: "04" }
];

export default function Page() {
  const { tasks, approvals, runtimes, roles, repos, githubRepos } = getDashboardData();
  const pendingApprovals = tasks.filter((task) => task.status.includes("WAITING")).length;
  const enabledRuntimes = runtimes.filter((runtime) => runtime.enabled).length;
  const connectedGithub = githubRepos.length;
  const blockedTasks = tasks.filter((task) => ["FAILED", "REJECTED"].includes(task.status)).length;
  const prTasks = tasks.filter((task) => task.pr || task.status.includes("PR") || task.status.includes("MERGE")).length;
  const actionTasks = [...tasks].sort((a, b) => {
    const aWaiting = a.status.includes("WAITING") ? 0 : 1;
    const bWaiting = b.status.includes("WAITING") ? 0 : 1;
    return aWaiting - bWaiting || b.id - a.id;
  });

  return (
    <main className="min-h-screen bg-[var(--ag-bg)] text-[var(--ag-text)]">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-[#343727] bg-[#0a0b08] lg:block">
          <div className="border-b border-[#343727] px-5 py-5">
            <div className="ag-kicker text-xs uppercase">agent-governor</div>
            <div className="mt-3 text-2xl font-black uppercase leading-none tracking-wide text-[#f8f1d0]">Control Plane</div>
          </div>
          <nav className="space-y-1 px-3 py-4 text-sm">
            {["01 Command", "02 Tasks", "03 Repos", "04 Approvals", "05 Runtimes"].map((item) => (
              <div className={item.includes("Command") ? "rounded-md border border-[#b8ff65]/45 bg-[#b8ff65]/10 px-3 py-2 font-semibold text-[#d6ff9f]" : "rounded-md px-3 py-2 text-[#8c8d7b] hover:bg-[#151710]"} key={item}>
                {item}
              </div>
            ))}
          </nav>
          <div className="absolute bottom-0 hidden w-[259px] border-t border-[#343727] p-4 lg:block">
            <div className="font-mono text-xs uppercase text-[#8c8d7b]">runtime mesh</div>
            <div className="mt-2 rounded-md border border-[#b8ff65]/30 bg-[#b8ff65]/10 px-3 py-2 text-sm text-[#d6ff9f]">{enabledRuntimes}/{runtimes.length} online</div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-[#343727] bg-[#0c0d09]/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="ag-kicker text-xs uppercase">[ local agent operating console ]</div>
                <h1 className="mt-1 text-3xl font-black uppercase leading-none tracking-wide text-[#f8f1d0]">Command Center</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden h-9 w-72 items-center rounded-md border border-[#343727] bg-[#090a07] px-3 font-mono text-xs uppercase text-[#8c8d7b] md:flex">Search tasks, repos, runs</div>
                <Link className="h-9 rounded-md border border-[#6bdcff]/45 bg-[#6bdcff]/10 px-3 py-2 text-sm font-semibold text-[#b5edff]" href="/settings/github">GitHub</Link>
              </div>
            </div>
          </header>

          <div className="px-5 py-5">
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric label="Managed repos" value={repos.length} detail={`${connectedGithub} synced from GitHub`} accent="emerald" />
              <Metric label="Governed tasks" value={tasks.length} detail={`${blockedTasks} blocked / failed`} accent="violet" />
              <Metric label="Owner gates" value={pendingApprovals} detail="requirements, design, PR, merge" accent="amber" />
              <Metric label="Runtime mesh" value={enabledRuntimes} detail={`${runtimes.length} configured adapters`} accent="sky" />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
              <div className="space-y-4">
                <AgentDirectory runtimes={runtimes} roles={roles} />

                <section className="grid gap-4 2xl:grid-cols-[1fr_320px]">
                  <OrchestrationCanvas tasks={tasks} repos={repos} runtimes={runtimes} approvals={approvals} />
                  <div className="space-y-4">
                    <section className="ag-panel rounded-md border">
                      <div className="border-b border-[#343727] px-4 py-3">
                        <div className="ag-kicker text-xs uppercase">[ command layer ]</div>
                        <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Telegram-first Controls</h2>
                      </div>
                      <div className="grid gap-px bg-[#343727] p-px">
                        {commands.map((command) => (
                          <div className="grid grid-cols-[42px_1fr_auto] items-center gap-3 bg-[#0a0b08] px-3 py-3" key={command.label}>
                            <span className="font-mono text-xs text-[#747763]">{command.key}</span>
                            <div>
                              <div className="font-mono text-sm text-[#f8f1d0]">{command.label}</div>
                              <div className="mt-1 text-xs text-[#9b9b89]">{command.detail}</div>
                            </div>
                            <span className="h-2 w-2 rounded-full bg-[#b8ff65] shadow-[0_0_18px_#b8ff65]" />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="ag-panel rounded-md border p-4">
                      <div className="ag-kicker text-xs uppercase">[ safety model ]</div>
                      <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Owner Gates</h2>
                      <div className="mt-4 grid gap-2">
                        {["Requirements approval", "Design approval", "PR approval", "Merge approval"].map((gate, index) => (
                          <div className="flex items-center justify-between rounded-md border border-[#343727] bg-[#090a07] px-3 py-2 text-sm" key={gate}>
                            <span>{gate}</span>
                            <span className={index < 2 ? "font-mono text-xs uppercase text-[#b8ff65]" : "font-mono text-xs uppercase text-[#ffca58]"}>{index < 2 ? "active" : "armed"}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </section>

                <section className="ag-panel rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343727] px-4 py-3">
                    <div>
                      <div className="ag-kicker text-xs uppercase">[ 01 / workflow ]</div>
                      <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Delivery Pipeline</h2>
                    </div>
                    <div className="font-mono text-xs uppercase text-[#9b9b89]">worktree isolated / owner approved</div>
                  </div>
                  <div className="grid gap-px bg-[#343727] p-px md:grid-cols-6">
                    {flow.map(([name, detail], index) => (
                      <div className="bg-[#0a0b08] p-4" key={name}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[#747763]">0{index + 1}</span>
                          <span className={index < 4 ? "font-mono text-xs uppercase text-[#b8ff65]" : "font-mono text-xs uppercase text-[#ffca58]"}>{index < 4 ? "ready" : "gated"}</span>
                        </div>
                        <div className="mt-3 text-sm font-black uppercase text-[#f8f1d0]">{name}</div>
                        <div className="mt-1 text-xs text-[#9b9b89]">{detail}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-3 xl:grid-cols-4">
                  {buckets.map((bucket) => {
                    const bucketTasks = tasks.filter((task) => stageBucket(task.status) === bucket);
                    return (
                      <div className="ag-panel rounded-md border" key={bucket}>
                        <div className="flex items-center justify-between border-b border-[#343727] px-3 py-2">
                          <h3 className="text-xs font-black uppercase text-[#f8f1d0]">{bucket}</h3>
                          <span className="rounded bg-[#202316] px-2 py-0.5 font-mono text-xs text-[#ffca58]">{bucketTasks.length}</span>
                        </div>
                        <div className="min-h-40 space-y-2 p-2">
                          {bucketTasks.map((task) => (
                            <Link className="block rounded-md border border-[#343727] bg-[#090a07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#ffca58]/60" href={`/tasks/${task.id}`} key={task.id}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs text-[#d6cfaa]">TASK-{task.id}</span>
                                <span className={`rounded border px-1.5 py-0.5 text-[11px] ${statusTone(task.status)}`}>{task.status}</span>
                              </div>
                              <div className="mt-2 truncate text-sm font-semibold text-[#f8f1d0]">{task.title}</div>
                              <div className="mt-1 truncate text-xs text-[#9b9b89]">{task.repo}</div>
                            </Link>
                          ))}
                          {bucketTasks.length === 0 ? <div className="p-3 text-xs text-[#747763]">Empty</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section className="ag-panel overflow-hidden rounded-md border">
                  <div className="border-b border-[#343727] px-4 py-3">
                    <div className="ag-kicker text-xs uppercase">[ 02 / ledger ]</div>
                    <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Task Ledger</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse text-sm">
                      <thead className="ag-table-head text-left text-xs uppercase">
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
                          <tr className="ag-row border-t border-[#343727]" key={task.id}>
                            <td className="px-3 py-3 font-mono text-xs"><Link className="text-[#ffca58] underline decoration-[#ffca58]/40 underline-offset-4" href={`/tasks/${task.id}`}>TASK-{task.id}</Link></td>
                            <td className="max-w-[320px] px-3 py-3"><div className="truncate font-semibold text-[#f8f1d0]">{task.title}</div><div className="mt-1 truncate text-xs text-[#9b9b89]">{task.description}</div></td>
                            <td className="px-3 py-3">{task.repo}</td>
                            <td className="px-3 py-3"><span className={`rounded border px-2 py-1 text-xs ${statusTone(task.status)}`}>{task.status}</span></td>
                            <td className="px-3 py-3 text-[#d6cfaa]">{nextAction(task.status)}</td>
                            <td className="px-3 py-3">{task.runtime}</td>
                            <td className="px-3 py-3 text-[#9b9b89]">{task.pr || "none"}</td>
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

                <section className="ag-panel rounded-md border p-4">
                  <div className="ag-kicker text-xs uppercase">[ queue ]</div>
                  <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Next Actions</h2>
                  <div className="mt-3 space-y-2">
                    {actionTasks.slice(0, 5).map((task) => (
                      <Link className="block rounded-md border border-[#343727] bg-[#090a07] px-3 py-2 hover:border-[#ffca58]/60" href={`/tasks/${task.id}`} key={task.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-[#d6cfaa]">TASK-{task.id}</span>
                          <span className="text-xs text-[#ffca58]">{nextAction(task.status)}</span>
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold text-[#f8f1d0]">{task.title}</div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="ag-panel rounded-md border p-4">
                  <div className="ag-kicker text-xs uppercase">[ mesh ]</div>
                  <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Runtime Router</h2>
                  <p className="mt-1 text-xs text-[#9b9b89]">{enabledRuntimes} enabled. Runtime availability comes from config.</p>
                  <div className="mt-4 grid gap-2">
                    {runtimes.map((runtime) => (
                      <div className="flex items-center justify-between rounded-md border border-[#343727] bg-[#090a07] px-3 py-2 text-sm" key={runtime.id}>
                        <div><div className="font-semibold text-[#f8f1d0]">{runtime.id}</div><div className="text-xs text-[#9b9b89]">{runtime.type}</div></div>
                        <span className={runtime.enabled ? "font-mono text-xs uppercase text-[#b8ff65]" : "font-mono text-xs uppercase text-[#747763]"}>{runtime.enabled ? "enabled" : "disabled"}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="ag-panel rounded-md border p-4">
                  <div className="ag-kicker text-xs uppercase">[ github ]</div>
                  <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">PR Channel</h2>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-[#343727] bg-[#090a07] px-3 py-2">
                      <div className="font-mono text-[10px] uppercase text-[#9b9b89]">Synced repos</div>
                      <div className="mt-1 text-lg font-semibold">{connectedGithub}</div>
                    </div>
                    <div className="rounded-md border border-[#343727] bg-[#090a07] px-3 py-2">
                      <div className="font-mono text-[10px] uppercase text-[#9b9b89]">PR tasks</div>
                      <div className="mt-1 text-lg font-semibold">{prTasks}</div>
                    </div>
                  </div>
                  <Link className="mt-3 block h-9 rounded-md border border-[#6bdcff]/45 bg-[#6bdcff]/10 px-3 py-2 text-center text-sm font-semibold text-[#b5edff]" href="/settings/github">Manage GitHub Auth</Link>
                </section>

                <section className="ag-panel rounded-md border p-4">
                  <div className="ag-kicker text-xs uppercase">[ registry ]</div>
                  <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Managed Repos</h2>
                  <div className="mt-3 space-y-2">
                    {repos.map((repo) => (
                      <div className="rounded-md border border-[#343727] bg-[#090a07] px-3 py-2 text-sm" key={repo.id}>
                        <div className="font-semibold text-[#f8f1d0]">{repo.name}</div>
                        <div className="mt-1 truncate text-xs text-[#9b9b89]">{repo.github}</div>
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

function AgentDirectory({
  runtimes,
  roles
}: {
  runtimes: Array<{ id: string; label: string; type: string; enabled: boolean; command: string | null; capabilities: string[]; preferredRoles: string[] }>;
  roles: Array<{ id: string; preferred: string[]; fallback: string[] }>;
}) {
  return (
    <section className="ag-panel rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343727] px-4 py-3">
        <div>
          <div className="ag-kicker text-xs uppercase">[ agents ]</div>
          <h2 className="mt-1 text-sm font-black uppercase text-[#f8f1d0]">Runtime Agents</h2>
        </div>
        <div className="font-mono text-xs uppercase text-[#9b9b89]">{runtimes.filter((runtime) => runtime.enabled).length}/{runtimes.length} enabled</div>
      </div>
      <div className="grid gap-px bg-[#343727] p-px xl:grid-cols-4">
        {runtimes.map((runtime) => (
          <div className="bg-[#090a07] p-4" key={runtime.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-black text-[#f8f1d0]">{runtime.label}</div>
                <div className="mt-1 font-mono text-xs uppercase text-[#9b9b89]">{runtime.type}</div>
              </div>
              <span className={runtime.enabled ? "rounded border border-[#b8ff65]/40 bg-[#b8ff65]/10 px-2 py-1 font-mono text-[10px] uppercase text-[#d6ff9f]" : "rounded border border-[#596044] bg-[#202316] px-2 py-1 font-mono text-[10px] uppercase text-[#8c8d7b]"}>
                {runtime.enabled ? "online" : "off"}
              </span>
            </div>
            <div className="mt-4 min-h-10 text-xs text-[#9b9b89]">
              {runtime.command ? <span className="font-mono text-[#d6cfaa]">{runtime.command}</span> : "placeholder adapter"}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {runtime.capabilities.map((capability) => (
                <span className="rounded border border-[#6bdcff]/25 bg-[#6bdcff]/8 px-2 py-1 font-mono text-[10px] uppercase text-[#b5edff]" key={capability}>{capability}</span>
              ))}
            </div>
            <div className="mt-4 border-t border-[#343727] pt-3">
              <div className="font-mono text-[10px] uppercase text-[#747763]">preferred roles</div>
              <div className="mt-2 min-h-8 text-xs text-[#d6cfaa]">
                {runtime.preferredRoles.length ? runtime.preferredRoles.join(", ") : "not preferred"}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-px bg-[#343727] p-px md:grid-cols-2 xl:grid-cols-4">
        {roles.map((role) => (
          <div className="bg-[#151710] px-3 py-2" key={role.id}>
            <div className="font-mono text-xs uppercase text-[#ffca58]">{role.id}</div>
            <div className="mt-1 truncate text-xs text-[#d6cfaa]">preferred: {role.preferred.join(", ")}</div>
            <div className="mt-1 truncate text-xs text-[#9b9b89]">fallback: {role.fallback.join(", ")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, detail, accent }: { label: string; value: number; detail: string; accent: "emerald" | "sky" | "violet" | "amber" }) {
  const tones = {
    emerald: "border-l-[#b8ff65] bg-[#b8ff65]/8",
    sky: "border-l-[#6bdcff] bg-[#6bdcff]/8",
    violet: "border-l-[#b69cff] bg-[#b69cff]/8",
    amber: "border-l-[#ffca58] bg-[#ffca58]/8"
  };
  return (
    <div className={`ag-panel rounded-md border border-l-4 ${tones[accent]} p-3 sm:p-4`}>
      <div className="font-mono text-xs uppercase text-[#9b9b89]">{label}</div>
      <div className="mt-2 text-3xl font-black leading-none text-[#f8f1d0] sm:text-4xl">{value}</div>
      <div className="mt-2 truncate text-xs text-[#9b9b89]">{detail}</div>
    </div>
  );
}

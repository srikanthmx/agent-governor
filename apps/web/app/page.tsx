import Link from "next/link";
import { CreateTaskPanel, RepoWorkbench, RunTaskButton } from "./dashboard-actions";
import { getDashboardData } from "./data";
import { OrchestrationCanvas } from "./orchestration-canvas";
import { RuntimeRescanButton } from "./runtime-rescan-button";
import { ThemeSwitcher } from "./theme-switcher";

function statusTone(status: string) {
  if (status.includes("WAITING")) return "border-[var(--ag-amber)] bg-[var(--ag-panel-2)] text-[var(--ag-amber)]";
  if (status === "FAILED" || status === "REJECTED") return "border-[var(--ag-coral)] bg-[var(--ag-panel-2)] text-[var(--ag-coral)]";
  if (status === "MERGED" || status === "PR_OPENED") return "border-[var(--ag-green)] bg-[var(--ag-panel-2)] text-[var(--ag-green)]";
  if (status === "FIXING") return "border-[var(--ag-cyan)] bg-[var(--ag-panel-2)] text-[var(--ag-cyan)]";
  return "border-[var(--ag-line)] bg-[var(--ag-panel-2)] text-[var(--ag-soft)]";
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
  { label: "/run", detail: "Execute next stage", key: "02" },
  { label: "/approve", detail: "Release gate", key: "03" },
  { label: "/pr", detail: "Open branch PR", key: "04" },
  { label: "/merge", detail: "Owner only", key: "05" }
];

export default function Page() {
  const { tasks, approvals, runtimes, roles, localTools, repos, githubRepos } = getDashboardData();
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
        <aside className="hidden border-r border-[var(--ag-line)] bg-[var(--ag-surface)] lg:block">
          <div className="border-b border-[var(--ag-line)] px-5 py-5">
            <div className="ag-kicker text-xs uppercase">agent-governor</div>
            <div className="mt-3 text-lg font-semibold leading-none text-[var(--ag-heading)]">Control Plane</div>
          </div>
          <nav className="space-y-1 px-3 py-4 text-sm">
            {["01 Command", "02 Tasks", "03 Repos", "04 Approvals", "05 Runtimes"].map((item) => (
              <div className={item.includes("Command") ? "rounded-md border border-[var(--ag-cyan)] bg-[var(--ag-panel)] px-3 py-2 font-medium text-[var(--ag-heading)]" : "rounded-md px-3 py-2 text-[var(--ag-muted)] hover:bg-[var(--ag-panel)]"} key={item}>
                {item}
              </div>
            ))}
          </nav>
          <div className="absolute bottom-0 hidden w-[259px] border-t border-[var(--ag-line)] p-4 lg:block">
            <div className="font-mono text-xs uppercase text-[var(--ag-muted)]">runtime mesh</div>
            <div className="mt-2 rounded-md border border-[var(--ag-green)] bg-[var(--ag-panel)] px-3 py-2 text-sm text-[var(--ag-green)]">{enabledRuntimes}/{runtimes.length} online</div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-[var(--ag-line)] bg-[var(--ag-bg)]/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="ag-kicker text-xs uppercase">[ local agent operating console ]</div>
                <h1 className="mt-1 text-xl font-semibold leading-none text-[var(--ag-heading)]">Command Center</h1>
              </div>
              <div className="flex items-center gap-2">
                <ThemeSwitcher />
                <div className="hidden h-8 w-64 items-center rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] px-3 text-xs text-[var(--ag-muted)] md:flex">Search tasks, repos, runs</div>
                <Link className="h-8 rounded-md border border-[var(--ag-cyan)] bg-[var(--ag-panel)] px-3 py-1.5 text-sm font-medium text-[var(--ag-heading)]" href="/settings/github">GitHub</Link>
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
                <section className="grid gap-4 2xl:grid-cols-[1fr_320px]">
                  <OrchestrationCanvas tasks={tasks} repos={repos} runtimes={runtimes} approvals={approvals} />
                  <div className="space-y-4">
                    <section className="ag-panel rounded-md border">
                      <div className="border-b border-[#343727] px-4 py-3">
                        <div className="ag-kicker text-xs uppercase">[ command layer ]</div>
                        <h2 className="mt-1 text-sm ag-section-title">Telegram-first Controls</h2>
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
                      <h2 className="mt-1 text-sm ag-section-title">Owner Gates</h2>
                      <div className="mt-4 grid gap-2">
                        {["Requirements approval", "Design approval", "PR approval", "Merge approval"].map((gate, index) => (
                          <div className="flex items-center justify-between rounded-md border border-[#343727] bg-[#090a07] px-3 py-2 text-sm" key={gate}>
                            <span>{gate}</span>
                            <span className={index < 2 ? "font-mono text-xs uppercase text-[#b8ff65]" : "font-mono text-xs uppercase text-[#ffca58]"}>{index < 2 ? "active" : "armed"}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="ag-panel rounded-md border p-4">
                      <div className="ag-kicker text-xs uppercase">[ run path ]</div>
                      <h2 className="mt-1 text-sm ag-section-title">How prompts execute</h2>
                      <div className="mt-4 space-y-2 text-sm text-[var(--ag-soft)]">
                        {[
                          "Pick repo and create a task from Web or Telegram.",
                          "Choose Codex, Claude, Gemini, OpenCode, or Shell as the preferred runtime.",
                          "Run next stage: requirements, design, then implementation in the task git worktree.",
                          "The prompt is written to a local prompt file and passed to the selected local CLI.",
                          "No direct model API is called unless an API adapter is explicitly configured and selected.",
                          "Owner approvals gate implementation, PR open, and merge."
                        ].map((item, index) => (
                          <div className="grid grid-cols-[24px_1fr] gap-2" key={item}>
                            <span className="font-mono text-xs text-[var(--ag-muted)]">{index + 1}</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </section>

                <AgentDirectory runtimes={runtimes} roles={roles} />
                <LocalToolDirectory tools={localTools} />

                <section className="ag-panel rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343727] px-4 py-3">
                    <div>
                      <div className="ag-kicker text-xs uppercase">[ 01 / workflow ]</div>
                      <h2 className="mt-1 text-sm ag-section-title">Delivery Pipeline</h2>
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
                        <div className="mt-3 text-sm font-semibold text-[var(--ag-heading)]">{name}</div>
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
                          <h3 className="text-xs font-semibold uppercase text-[var(--ag-heading)]">{bucket}</h3>
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
                    <h2 className="mt-1 text-sm ag-section-title">Task Ledger</h2>
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
                <CreateTaskPanel repos={repos} runtimes={runtimes} />

                <section className="ag-panel rounded-md border p-4">
                  <div className="ag-kicker text-xs uppercase">[ queue ]</div>
                  <h2 className="mt-1 text-sm ag-section-title">Next Actions</h2>
                  <div className="mt-3 space-y-2">
                    {actionTasks.slice(0, 5).map((task) => (
                      <div className="rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] p-3" key={task.id}>
                        <Link className="block" href={`/tasks/${task.id}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-xs text-[var(--ag-soft)]">TASK-{task.id}</span>
                            <span className="text-xs text-[var(--ag-amber)]">{nextAction(task.status)}</span>
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold text-[var(--ag-heading)]">{task.title}</div>
                        </Link>
                        <div className="mt-3">
                          <RunTaskButton taskId={task.id} runtimes={runtimes} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="ag-panel rounded-md border p-4">
                  <div className="ag-kicker text-xs uppercase">[ mesh ]</div>
                  <h2 className="mt-1 text-sm ag-section-title">Runtime Router</h2>
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
                  <h2 className="mt-1 text-sm ag-section-title">PR Channel</h2>
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
                  <h2 className="mt-1 text-sm ag-section-title">Managed Repos</h2>
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
  runtimes: Array<{ id: string; label: string; type: string; enabled: boolean; configuredEnabled: boolean; detected: boolean; detectedCommand: string | null; command: string | null; args: string[]; capabilities: string[]; preferredRoles: string[] }>;
  roles: Array<{ id: string; preferred: string[]; fallback: string[] }>;
}) {
  return (
    <section className="ag-panel rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343727] px-4 py-3">
        <div>
          <div className="ag-kicker text-xs uppercase">[ agents ]</div>
          <h2 className="mt-1 text-sm ag-section-title">Runtime Agents</h2>
        </div>
        <div className="flex items-center gap-3">
          <RuntimeRescanButton />
          <div className="font-mono text-xs uppercase text-[#9b9b89]">{runtimes.filter((runtime) => runtime.enabled).length}/{runtimes.length} usable</div>
        </div>
      </div>
      <div className="grid gap-px bg-[#343727] p-px xl:grid-cols-4">
        {runtimes.map((runtime) => (
          <div className="bg-[#090a07] p-4" key={runtime.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--ag-heading)]">{runtime.label}</div>
                <div className="mt-1 font-mono text-xs uppercase text-[#9b9b89]">{runtime.type}</div>
              </div>
              <span className={runtime.enabled ? "rounded border border-[var(--ag-green)] bg-[var(--ag-panel-2)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--ag-green)]" : "rounded border border-[var(--ag-line)] bg-[var(--ag-panel-2)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--ag-muted)]"}>
                {runtime.detected ? "detected" : runtime.enabled ? "configured" : "missing"}
              </span>
            </div>
            <div className="mt-4 min-h-10 text-xs text-[#9b9b89]">
              {runtime.command ? <span className="font-mono text-[var(--ag-soft)]">{[runtime.command, ...runtime.args].join(" ")}</span> : "placeholder adapter"}
            </div>
            <div className="mt-2 text-xs text-[var(--ag-muted)]">
              {runtime.detectedCommand ? `${runtime.detected ? "Found" : "Looking for"} ${runtime.detectedCommand}` : "No local CLI detection"}
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

function LocalToolDirectory({
  tools
}: {
  tools: Array<{ id: string; label: string; kind: string; runnable: boolean; detected: boolean; detectedBy: string | null; configured: boolean; enabled: boolean; capabilities: string[] }>;
}) {
  const detected = tools.filter((tool) => tool.detected);
  return (
    <section className="ag-panel rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ag-line)] px-4 py-3">
        <div>
          <div className="ag-kicker text-xs uppercase">[ local scan ]</div>
          <h2 className="mt-1 text-sm ag-section-title">Detected IDEs & Agents</h2>
          <p className="mt-1 text-xs text-[var(--ag-muted)]">Detected runnable agents can execute prompts locally. Detected IDEs/bridges are shown as adapter candidates to add when a safe CLI bridge is available.</p>
        </div>
        <div className="font-mono text-xs uppercase text-[var(--ag-muted)]">{detected.length}/{tools.length} found locally</div>
      </div>
      <div className="grid gap-px bg-[var(--ag-line)] p-px md:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => (
          <div className="bg-[var(--ag-surface)] p-3" key={tool.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--ag-heading)]">{tool.label}</div>
                <div className="mt-1 font-mono text-[10px] uppercase text-[var(--ag-muted)]">{tool.kind}{tool.runnable ? " / prompt runnable" : " / integration candidate"}</div>
              </div>
              <span className={tool.detected ? "rounded border border-[var(--ag-green)] bg-[var(--ag-panel-2)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--ag-green)]" : "rounded border border-[var(--ag-line)] bg-[var(--ag-panel-2)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--ag-muted)]"}>
                {tool.detected ? "found" : "missing"}
              </span>
            </div>
            <div className="mt-3 min-h-8 text-xs text-[var(--ag-muted)]">{tool.detectedBy ?? "Install locally to enable discovery."}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {tool.capabilities.slice(0, 3).map((capability) => (
                <span className="rounded border border-[var(--ag-line)] bg-[var(--ag-panel)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--ag-soft)]" key={capability}>{capability}</span>
              ))}
            </div>
            <div className="mt-3 border-t border-[var(--ag-line)] pt-2 text-xs text-[var(--ag-muted)]">
              {tool.runnable
                ? tool.detected
                  ? "Available for local prompt routing."
                  : "Install locally to make it selectable."
                : tool.detected
                  ? "Available locally. Add a CLI bridge before routing prompts."
                  : "Not found locally yet."}
            </div>
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
      <div className="mt-2 text-2xl font-semibold leading-none text-[var(--ag-heading)] sm:text-3xl">{value}</div>
      <div className="mt-2 truncate text-xs text-[#9b9b89]">{detail}</div>
    </div>
  );
}

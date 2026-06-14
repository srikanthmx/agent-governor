import { HermesSidecarPanel } from "./hermes-sidecar-panel";

const peers = [
  {
    name: "Srikanth MacBook",
    status: "live",
    session: "outbound socket",
    shared: ["Codex", "Gemini CLI"],
    private: ["Antigravity"],
    activeTask: "TASK-6",
    latency: "84ms"
  },
  {
    name: "Desktop node",
    status: "standby",
    session: "heartbeat 12s ago",
    shared: ["Qwen Code"],
    private: ["Goose"],
    activeTask: "idle",
    latency: "112ms"
  },
  {
    name: "Work laptop",
    status: "restricted",
    session: "repo allowlist",
    shared: ["Dry-run shell"],
    private: ["Local agents"],
    activeTask: "idle",
    latency: "locked"
  }
];

const streamEvents = [
  { time: "18:16:42", channel: "telegram", text: "PR link posted with progress room", tone: "success" },
  { time: "18:16:18", channel: "peer", text: "Gemini CLI completed on Srikanth MacBook", tone: "success" },
  { time: "18:14:09", channel: "runtime", text: "stderr captured and attached to TASK-6", tone: "warning" },
  { time: "18:12:31", channel: "approval", text: "PR approved from web room", tone: "success" },
  { time: "18:10:04", channel: "router", text: "Matched TASK-6 to P2P shared Gemini CLI", tone: "active" },
  { time: "18:09:58", channel: "peer", text: "Srikanth MacBook claimed run session", tone: "active" }
];

const sharedRuntimes = [
  { peer: "Srikanth MacBook", runtime: "Codex", scope: "P2P shared", mode: "CLI", status: "usable" },
  { peer: "Srikanth MacBook", runtime: "Gemini CLI", scope: "P2P shared", mode: "CLI", status: "running" },
  { peer: "Srikanth MacBook", runtime: "Antigravity", scope: "Private", mode: "App", status: "owner only" },
  { peer: "Desktop node", runtime: "Qwen Code", scope: "P2P shared", mode: "CLI", status: "standby" },
  { peer: "Desktop node", runtime: "Goose", scope: "Private", mode: "CLI", status: "owner only" }
];

const tasks = [
  {
    id: "TASK-6",
    title: "change title to srikanth",
    stage: "PR opened",
    peer: "Srikanth MacBook",
    agent: "Gemini CLI",
    progress: "100%",
    pr: "github.com/srikanthmx/abandoned-circle/pull/3",
    preview: "waiting for deploy preview"
  },
  {
    id: "TASK-8",
    title: "route Telegram prompt to desktop",
    stage: "Design approval",
    peer: "unassigned",
    agent: "best shared CLI",
    progress: "40%",
    pr: "not opened",
    preview: "not available"
  }
];

function statusClass(status: string) {
  if (status === "live" || status === "usable" || status === "running") return "ag-badge-success";
  if (status === "standby") return "ag-badge-waiting";
  return "ag-badge-neutral";
}

function eventToneClass(tone: string) {
  if (tone === "success") return "bg-[rgba(34,197,94,0.12)] text-[var(--ag-green)]";
  if (tone === "warning") return "bg-[rgba(245,158,11,0.12)] text-[var(--ag-amber)]";
  return "bg-[rgba(59,130,246,0.12)] text-[var(--ag-blue)]";
}

function StatusDot({ status }: { status: string }) {
  const color = status === "live" ? "var(--ag-green)" : status === "standby" ? "var(--ag-amber)" : "var(--ag-text-4)";
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: status === "live" ? `0 0 8px ${color}` : "none" }} />;
}

export function ControlPlaneDashboard() {
  return (
    <div className="ag-animate-in">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="ag-badge ag-badge-success">Live control plane</span>
            <span className="ag-badge ag-badge-neutral">Runtime router</span>
          </div>
          <h1 className="text-[20px] font-semibold leading-tight text-[var(--ag-text-1)]">AI Runtime Control Plane</h1>
          <p className="mt-1 max-w-[720px] text-[13px] text-[var(--ag-text-3)]">
            Govern, route, audit, and optimize AI work while opted-in desktops run the actual coding runtimes.
          </p>
        </div>
        <a className="ag-btn ag-btn-primary" href="/tasks/6">Open Live Room</a>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="ag-card ag-card-glow-blue p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Now streaming</div>
              <div className="mt-1 text-[16px] font-semibold text-[var(--ag-text-1)]">TASK-6 · Gemini CLI on Srikanth MacBook</div>
            </div>
            <span className="ag-badge ag-badge-success">PR opened</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="text-[11px] text-[var(--ag-text-4)]">Route</div>
              <div className="mt-1 text-[13px] text-[var(--ag-text-1)]">P2P shared</div>
            </div>
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="text-[11px] text-[var(--ag-text-4)]">Approvals</div>
              <div className="mt-1 text-[13px] text-[var(--ag-green)]">3 approved</div>
            </div>
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="text-[11px] text-[var(--ag-text-4)]">Logs</div>
              <div className="mt-1 text-[13px] text-[var(--ag-amber)]">stderr captured</div>
            </div>
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
              <div className="text-[11px] text-[var(--ag-text-4)]">Preview</div>
              <div className="mt-1 text-[13px] text-[var(--ag-text-2)]">pending</div>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[var(--ag-bg)]">
            <div className="h-2 rounded-full bg-[var(--ag-green)]" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="ag-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Pair Peer</div>
            <span className="ag-badge ag-badge-active">code active</span>
          </div>
          <div className="rounded-md bg-[var(--ag-bg)] p-4">
            <div className="text-[11px] text-[var(--ag-text-4)]">Desktop generated code</div>
            <div className="mt-1 font-mono text-[26px] font-semibold tracking-[0.18em] text-[var(--ag-text-1)]">K7P-42M</div>
            <div className="mt-3 text-[11px] leading-relaxed text-[var(--ag-text-3)]">
              Pair a desktop, then choose which detected runtimes are shared. Everything else remains private to that user.
            </div>
          </div>
        </div>
      </div>

      <div className="ag-card mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Hermes bridge</div>
            <div className="mt-1 text-[15px] font-semibold text-[var(--ag-text-1)]">OpenAI-compatible local model adapter</div>
          </div>
          <span className="ag-badge ag-badge-active">facade online</span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Health</div>
            <div className="mt-1 font-mono text-[12px] text-[var(--ag-text-1)]">GET /api/hermes/health</div>
          </div>
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Model facade</div>
            <div className="mt-1 font-mono text-[12px] text-[var(--ag-text-1)]">/v1/chat/completions</div>
          </div>
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Hermes behavior</div>
            <div className="mt-1 text-[12px] text-[var(--ag-text-1)]">model response only</div>
          </div>
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Side effects</div>
            <div className="mt-1 text-[12px] text-[var(--ag-green)]">no PR/task</div>
          </div>
        </div>
      </div>

      <HermesSidecarPanel />

      <div className="mb-5 grid gap-4 lg:grid-cols-4">
        <div className="ag-card p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Connected peers</div>
          <div className="mt-2 text-[24px] font-semibold text-[var(--ag-text-1)]">3</div>
        </div>
        <div className="ag-card p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Shared runtimes</div>
          <div className="mt-2 text-[24px] font-semibold text-[var(--ag-text-1)]">3</div>
        </div>
        <div className="ag-card p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Awaiting approval</div>
          <div className="mt-2 text-[24px] font-semibold text-[var(--ag-amber)]">1</div>
        </div>
        <div className="ag-card p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ag-text-4)]">Stream events</div>
          <div className="mt-2 text-[24px] font-semibold text-[var(--ag-text-1)]">6</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="ag-card">
            <div className="border-b border-[var(--ag-border)] px-4 py-3">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Peer Routing</div>
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-3">
              {peers.map((peer) => (
                <div key={peer.name} className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium text-[var(--ag-text-1)]">
                      <StatusDot status={peer.status} />
                      {peer.name}
                    </div>
                    <span className={`ag-badge ag-badge-sm ${statusClass(peer.status)}`}>{peer.status}</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ag-text-4)]">Session</span>
                      <span className="text-right text-[var(--ag-text-2)]">{peer.session}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ag-text-4)]">Runtimes</span>
                      <span className="text-right text-[var(--ag-green)]">{peer.shared.join(", ")}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ag-text-4)]">Private</span>
                      <span className="text-right text-[var(--ag-text-4)]">{peer.private.join(", ")}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ag-text-4)]">Active</span>
                      <span className="text-right text-[var(--ag-text-2)]">{peer.activeTask}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ag-card">
            <div className="border-b border-[var(--ag-border)] px-4 py-3">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Task Streams</div>
            </div>
            <div className="space-y-2 p-3">
              {tasks.map((task) => (
                <a key={task.id} href={`/tasks/${task.id.replace("TASK-", "")}`} className="block rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 transition-colors hover:border-[var(--ag-border-bold)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-[var(--ag-text-4)]">{task.id}</div>
                      <div className="truncate text-[13px] font-medium text-[var(--ag-text-1)]">{task.title}</div>
                    </div>
                    <span className={`ag-badge ${task.stage === "PR opened" ? "ag-badge-success" : "ag-badge-waiting"}`}>{task.stage}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-[11px] text-[var(--ag-text-3)] md:grid-cols-4">
                    <div>Peer: <span className="text-[var(--ag-text-2)]">{task.peer}</span></div>
                    <div>Runtime: <span className="text-[var(--ag-text-2)]">{task.agent}</span></div>
                    <div>PR: <span className="text-[var(--ag-text-2)]">{task.pr}</span></div>
                    <div>Preview: <span className="text-[var(--ag-text-2)]">{task.preview}</span></div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-[var(--ag-raised)]">
                    <div className="h-1.5 rounded-full bg-[var(--ag-blue)]" style={{ width: task.progress }} />
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="ag-card">
            <div className="border-b border-[var(--ag-border)] px-4 py-3">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Runtime Sharing</div>
            </div>
            <div className="divide-y divide-[var(--ag-border)]">
              {sharedRuntimes.map((runtime) => (
                <div key={`${runtime.peer}-${runtime.runtime}`} className="grid gap-3 px-4 py-3 text-[12px] md:grid-cols-[160px_1fr_110px_90px_90px]">
                  <div className="text-[var(--ag-text-3)]">{runtime.peer}</div>
                  <div className="font-medium text-[var(--ag-text-1)]">{runtime.runtime}</div>
                  <div className={runtime.scope === "P2P shared" ? "text-[var(--ag-green)]" : "text-[var(--ag-text-4)]"}>{runtime.scope}</div>
                  <div className="text-[var(--ag-text-3)]">{runtime.mode}</div>
                  <div className="text-right text-[var(--ag-text-4)]">{runtime.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="ag-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="ag-section-label">Live Event Stream</div>
              <span className="ag-badge ag-badge-active">streaming</span>
            </div>
            <div className="space-y-2">
              {streamEvents.map((event) => (
                <div key={`${event.time}-${event.text}`} className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${eventToneClass(event.tone)}`}>{event.channel}</span>
                    <span className="font-mono text-[10px] text-[var(--ag-text-4)]">{event.time}</span>
                  </div>
                  <div className="text-[12px] leading-snug text-[var(--ag-text-2)]">{event.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Telegram Card</div>
            <div className="rounded-md bg-[var(--ag-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ag-text-2)]">
              TASK-6 PR opened<br />
              Progress: /tasks/6<br />
              PR: github.com/.../pull/3<br />
              Preview: pending deploy
            </div>
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Stream Endpoints</div>
            <div className="space-y-2 font-mono text-[11px] text-[var(--ag-text-3)]">
              <div>POST /api/flows/telegram-hermes</div>
              <div>POST /api/flows/cron-hermes</div>
              <div>POST /api/telegram/webhook</div>
              <div>POST /api/telegram/set-webhook</div>
              <div>POST /api/hermes/v1/chat/completions</div>
              <div>POST /api/hermes/v1/agent-runs</div>
              <div>GET /api/hermes/v1/agent-runs/:id/events</div>
              <div>POST /api/peers/pair-code</div>
              <div>POST /api/peers/claim</div>
              <div>GET /api/tasks/:id/events</div>
              <div>POST /api/nodes/events</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

const logLines = [
  "18:09:58 router  matched TASK-6 to Gemini CLI on Srikanth MacBook",
  "18:10:01 hermes  model facade returned govrun_6",
  "18:10:04 peer    socket session claimed run e02e9d6f",
  "18:10:11 agent   prompt delivered to P2P shared Gemini CLI",
  "18:12:31 web     PR approval received from owner",
  "18:14:09 agent   stderr captured: model capacity warning",
  "18:16:18 peer    branch pushed to GitHub",
  "18:16:42 github  pull request opened",
  "18:16:45 notify  Telegram card posted with progress and PR links"
];

const approvals = [
  { stage: "Requirements", status: "approved", by: "web" },
  { stage: "Design", status: "approved", by: "web" },
  { stage: "PR", status: "approved", by: "web" },
  { stage: "Preview", status: "pending", by: "deploy" }
];

const runMeta = [
  ["Peer", "Srikanth MacBook"],
  ["Agent", "Gemini CLI"],
  ["Hermes Run", "govrun_6"],
  ["Sharing", "P2P shared"],
  ["Transport", "outbound socket"],
  ["Repo", "abandoned-circle"],
  ["Branch", "agent/TASK-6-change-title-to-srikanth"]
];

export function ControlPlaneTaskRoom({ taskId }: { taskId: string }) {
  return (
    <div className="ag-animate-in">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-[12px] text-[var(--ag-text-4)] hover:text-[var(--ag-text-2)]">Control Plane</Link>
          <span className="text-[var(--ag-text-4)]">/</span>
          <span className="font-mono text-[12px] text-[var(--ag-text-2)]">TASK-{taskId}</span>
        </div>
        <span className="ag-badge ag-badge-active">streaming room</span>
      </div>

      <div className="ag-card ag-card-glow-blue mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[11px] text-[var(--ag-text-4)]">TASK-{taskId}</span>
              <span className="ag-badge ag-badge-success">PR opened</span>
              <span className="ag-badge ag-badge-active">Hermes bridge</span>
              <span className="ag-badge ag-badge-neutral">No cloud agent</span>
            </div>
            <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)]">change title to srikanth</h1>
            <p className="mt-1 max-w-[720px] text-[13px] text-[var(--ag-text-3)]">
              Routed from Telegram to an opted-in desktop peer. This room streams the run, approvals, notifications, PR, and preview state.
            </p>
          </div>
          <a className="ag-btn ag-btn-primary" href="https://github.com/srikanthmx/abandoned-circle/pull/3">Open PR</a>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Peer</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--ag-text-1)]">Srikanth MacBook</div>
          </div>
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Agent</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--ag-text-1)]">Gemini CLI</div>
          </div>
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Sharing</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--ag-green)]">P2P shared</div>
          </div>
          <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
            <div className="text-[11px] text-[var(--ag-text-4)]">Preview</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--ag-amber)]">pending deploy</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="ag-card">
            <div className="flex items-center justify-between border-b border-[var(--ag-border)] px-4 py-3">
              <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Live Agent Stream</div>
              <span className="ag-badge ag-badge-success">connected</span>
            </div>
            <pre className="max-h-[520px] overflow-auto p-4 text-[12px] leading-relaxed text-[var(--ag-text-2)]">{logLines.join("\n")}</pre>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="ag-card">
              <div className="border-b border-[var(--ag-border)] px-4 py-3 text-[13px] font-medium text-[var(--ag-text-1)]">Links</div>
              <div className="space-y-2 p-4">
                <a className="block rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-blue)] hover:border-[var(--ag-border-bold)]" href="https://github.com/srikanthmx/abandoned-circle/pull/3">
                  GitHub pull request
                </a>
                <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-text-3)]">
                  Deploy preview pending
                </div>
              </div>
            </div>

            <div className="ag-card">
              <div className="border-b border-[var(--ag-border)] px-4 py-3 text-[13px] font-medium text-[var(--ag-text-1)]">Telegram Card</div>
              <div className="p-4">
                <div className="rounded-md bg-[var(--ag-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ag-text-2)]">
                  TASK-{taskId} PR opened<br />
                  Progress: /tasks/{taskId}<br />
                  PR: github.com/.../pull/3<br />
                  Preview: pending
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Approvals</div>
            <div className="space-y-2">
              {approvals.map((approval) => (
                <div key={approval.stage} className="flex items-center justify-between rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] px-3 py-2 text-[12px]">
                  <div>
                    <div className="text-[var(--ag-text-1)]">{approval.stage}</div>
                    <div className="text-[10px] text-[var(--ag-text-4)]">via {approval.by}</div>
                  </div>
                  <span className={approval.status === "approved" ? "text-[var(--ag-green)]" : "text-[var(--ag-amber)]"}>{approval.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Hermes Contract</div>
            <div className="space-y-2 font-mono text-[11px] text-[var(--ag-text-3)]">
              <div>model: governor/hermes-bridge</div>
              <div>run: govrun_6</div>
              <div>events: /api/hermes/v1/agent-runs/govrun_6/events</div>
              <div>chat: /api/hermes/v1/chat/completions</div>
            </div>
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Run Metadata</div>
            <div className="space-y-2 text-[12px]">
              {runMeta.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-[var(--ag-text-4)]">{label}</span>
                  <span className="text-right text-[var(--ag-text-2)]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ag-card p-4">
            <div className="ag-section-label mb-3">Stream Policy</div>
            <div className="space-y-2 text-[11px] leading-relaxed text-[var(--ag-text-3)]">
              <div>Cloud stores status, approvals, redacted logs, PR links, preview links, and analytics.</div>
              <div>Desktop peer owns repo access, agent execution, commits, and pushes.</div>
              <div>Private agents never enter P2P routing.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

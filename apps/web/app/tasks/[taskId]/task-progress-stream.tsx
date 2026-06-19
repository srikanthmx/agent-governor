"use client";

import { useEffect, useMemo, useState } from "react";

type ProgressEvent = {
  id: string;
  type: string;
  label: string;
  message: string;
  taskId: number;
  stage: string | null;
  status: string | null;
  actorType: string;
  actorId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type Snapshot = {
  task: {
    id: number;
    title: string;
    description: string;
    repo: string;
    status: string;
    stage: string | null;
    branch: string | null;
    prUrl: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  nextAction: {
    type: string;
    stage: string | null;
    label: string;
  };
  links: {
    progressUrl: string;
    prUrl: string | null;
    eventsUrl: string;
    streamUrl: string;
  };
};

function eventTone(type: string) {
  if (type.includes("failed") || type === "task.rejected") return "text-[var(--ag-red)]";
  if (type.includes("approval") || type === "input.required") return "text-[var(--ag-amber)]";
  if (type.includes("completed") || type.includes("opened")) return "text-[var(--ag-green)]";
  return "text-[var(--ag-text-2)]";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TaskProgressStream({ taskId, initialSnapshot }: { taskId: number; initialSnapshot: Snapshot & { events: ProgressEvent[] } }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [events, setEvents] = useState<ProgressEvent[]>(initialSnapshot.events);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/tasks/${taskId}/events?stream=true`);
    source.addEventListener("open", () => {
      setConnected(true);
      setError(null);
    });
    source.addEventListener("snapshot", (event) => {
      const next = JSON.parse((event as MessageEvent).data) as Snapshot;
      setSnapshot(next);
    });
    source.addEventListener("progress", (event) => {
      const next = JSON.parse((event as MessageEvent).data) as ProgressEvent;
      setEvents((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
    });
    source.addEventListener("done", () => {
      setConnected(false);
      source.close();
    });
    source.addEventListener("error", () => {
      setConnected(false);
      setError("Stream reconnecting or unavailable");
    });
    return () => source.close();
  }, [taskId]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [events]
  );

  return (
    <div className="space-y-5">
      <div className="ag-card">
        <div className="flex items-center justify-between border-b border-[var(--ag-border)] px-4 py-3">
          <div>
            <div className="text-[13px] font-medium text-[var(--ag-text-1)]">Live Task Stream</div>
            <div className="mt-1 text-[11px] text-[var(--ag-text-4)]">{snapshot.nextAction.label}</div>
          </div>
          <span className={`ag-badge ${connected ? "ag-badge-success" : "ag-badge-muted"}`}>{connected ? "connected" : "snapshot"}</span>
        </div>
        {error && <div className="border-b border-[var(--ag-border)] px-4 py-2 text-[11px] text-[var(--ag-amber)]">{error}</div>}
        <div className="max-h-[520px] overflow-auto p-4">
          {sortedEvents.length === 0 ? (
            <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-text-3)]">No events yet.</div>
          ) : (
            <div className="space-y-2">
              {sortedEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-[12px] font-medium ${eventTone(event.type)}`}>{event.label}</div>
                      <div className="mt-1 text-[12px] text-[var(--ag-text-2)]">{event.message}</div>
                      <div className="mt-1 text-[10px] text-[var(--ag-text-4)]">
                        {event.actorId ?? event.actorType}{event.stage ? ` · ${event.stage}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[10px] text-[var(--ag-text-4)]">{formatTime(event.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="ag-card">
          <div className="border-b border-[var(--ag-border)] px-4 py-3 text-[13px] font-medium text-[var(--ag-text-1)]">Client Contract</div>
          <div className="space-y-2 p-4 font-mono text-[11px] text-[var(--ag-text-3)]">
            <div>json: {snapshot.links.eventsUrl}</div>
            <div>stream: {snapshot.links.streamUrl}</div>
            <div>hermes: /api/hermes/v1/agent-runs/govrun_{taskId}/events</div>
          </div>
        </div>
        <div className="ag-card">
          <div className="border-b border-[var(--ag-border)] px-4 py-3 text-[13px] font-medium text-[var(--ag-text-1)]">Output Links</div>
          <div className="space-y-2 p-4">
            {snapshot.links.prUrl ? (
              <a className="block rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-blue)] hover:border-[var(--ag-border-bold)]" href={snapshot.links.prUrl}>
                GitHub pull request
              </a>
            ) : (
              <div className="rounded-md border border-[var(--ag-border)] bg-[var(--ag-bg)] p-3 text-[12px] text-[var(--ag-text-3)]">Pull request not opened yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

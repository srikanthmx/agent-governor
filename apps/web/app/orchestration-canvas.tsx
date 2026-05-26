"use client";

import { useMemo, useState } from "react";

type Task = {
  id: number;
  title: string;
  repo: string;
  status: string;
  stage: string | null;
  runtime: string;
  pr: string | null;
};

type Repo = {
  id: number;
  name: string;
  github: string;
};

type Runtime = {
  id: string;
  type: string;
  enabled: boolean;
};

type Approval = {
  taskId: number;
  stage: string;
  status: string;
};

type NodeKind = "input" | "governor" | "repo" | "task" | "runtime" | "approval" | "pr";

type CanvasNode = {
  id: string;
  label: string;
  detail: string;
  meta: string;
  kind: NodeKind;
  x: number;
  y: number;
  active: boolean;
};

type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  active: boolean;
};

const kindTone: Record<NodeKind, string> = {
  input: "border-sky-400/50 text-sky-100",
  governor: "border-emerald-400/70 text-emerald-100",
  repo: "border-zinc-600 text-zinc-100",
  task: "border-violet-400/60 text-violet-100",
  runtime: "border-amber-300/60 text-amber-100",
  approval: "border-orange-300/70 text-orange-100",
  pr: "border-cyan-300/60 text-cyan-100"
};

const kindDot: Record<NodeKind, string> = {
  input: "bg-sky-300",
  governor: "bg-emerald-300",
  repo: "bg-zinc-300",
  task: "bg-violet-300",
  runtime: "bg-amber-200",
  approval: "bg-orange-300",
  pr: "bg-cyan-300"
};

function taskRoute(status: string) {
  if (status.includes("WAITING")) return "approval";
  if (["PR_READY", "PR_OPENED", "WAITING_MERGE_APPROVAL", "MERGED"].includes(status)) return "pr";
  if (["IMPLEMENTING", "TESTING", "REVIEWING", "FIXING"].includes(status)) return "runtime";
  return "governor";
}

function edgePath(from: CanvasNode, to: CanvasNode) {
  const mid = from.x + (to.x - from.x) * 0.5;
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
}

export function OrchestrationCanvas({
  tasks,
  repos,
  runtimes,
  approvals
}: {
  tasks: Task[];
  repos: Repo[];
  runtimes: Runtime[];
  approvals: Approval[];
}) {
  const { nodes, edges } = useMemo(() => {
    const pendingApprovals = approvals.filter((approval) => approval.status !== "APPROVED").length;
    const prTasks = tasks.filter((task) => task.pr || task.status.includes("PR") || task.status.includes("MERGE")).length;
    const enabledRuntimeCount = runtimes.filter((runtime) => runtime.enabled).length;
    const visibleRepos = repos.slice(0, 3);
    const visibleTasks = tasks.slice(0, 4);
    const visibleRuntimes = runtimes.slice(0, 3);

    const nextNodes: CanvasNode[] = [
      { id: "telegram", label: "Telegram", detail: "Owner and contributor command surface", meta: "/idea /approve /merge", kind: "input", x: 12, y: 25, active: true },
      { id: "web", label: "Web UI", detail: "Repo, task, runtime, and approval operations", meta: "local dashboard", kind: "input", x: 12, y: 50, active: true },
      {
        id: "governor",
        label: "Governor",
        detail: "Policy, routing, audit, approvals, and workflow state",
        meta: `${tasks.length} tasks routed`,
        kind: "governor",
        x: 41,
        y: 39,
        active: true
      },
      {
        id: "approval",
        label: "Approval Gate",
        detail: "Requirements, design, PR, and merge gates",
        meta: `${pendingApprovals} pending`,
        kind: "approval",
        x: 61,
        y: 64,
        active: pendingApprovals > 0
      },
      {
        id: "pr",
        label: "GitHub PR",
        detail: "Branches and pull requests created from task worktrees",
        meta: `${prTasks} PR-linked`,
        kind: "pr",
        x: 84,
        y: 65,
        active: prTasks > 0
      }
    ];

    visibleRepos.forEach((repo, index) => {
      nextNodes.push({
        id: `repo-${repo.id}`,
        label: repo.name,
        detail: repo.github,
        meta: "managed repo",
        kind: "repo",
        x: 20,
        y: 72 + index * 8,
        active: true
      });
    });

    visibleTasks.forEach((task, index) => {
      const route = taskRoute(task.status);
      nextNodes.push({
        id: `task-${task.id}`,
        label: `TASK-${task.id}`,
        detail: task.title,
        meta: `${task.repo} / ${task.status}`,
        kind: "task",
        x: 43 + (index % 2) * 14,
        y: 78 + Math.floor(index / 2) * 9,
        active: route !== "governor"
      });
    });

    visibleRuntimes.forEach((runtime, index) => {
      nextNodes.push({
        id: `runtime-${runtime.id}`,
        label: runtime.id,
        detail: `${runtime.type} adapter`,
        meta: runtime.enabled ? "enabled" : "disabled",
        kind: "runtime",
        x: 80,
        y: 24 + index * 11,
        active: runtime.enabled
      });
    });

    const enabledRuntime = visibleRuntimes.find((runtime) => runtime.enabled) ?? visibleRuntimes[0];
    const runtimeTarget = enabledRuntime ? `runtime-${enabledRuntime.id}` : "governor";
    const edges: CanvasEdge[] = [
      { id: "telegram-governor", from: "telegram", to: "governor", active: true },
      { id: "web-governor", from: "web", to: "governor", active: true },
      { id: "governor-approval", from: "governor", to: "approval", active: pendingApprovals > 0 },
      { id: "governor-pr", from: "governor", to: "pr", active: prTasks > 0 },
      { id: "governor-runtime", from: "governor", to: runtimeTarget, active: enabledRuntimeCount > 0 }
    ];

    visibleRepos.forEach((repo) => {
      edges.push({ id: `repo-${repo.id}-governor`, from: `repo-${repo.id}`, to: "governor", active: true });
    });

    visibleTasks.forEach((task) => {
      const route = taskRoute(task.status);
      const target = route === "runtime" ? runtimeTarget : route;
      edges.push({ id: `governor-task-${task.id}`, from: "governor", to: `task-${task.id}`, active: true });
      edges.push({ id: `task-${task.id}-${target}`, from: `task-${task.id}`, to: target, active: target !== "governor" });
    });

    return { nodes: nextNodes, edges };
  }, [approvals, repos, runtimes, tasks]);

  const [selectedId, setSelectedId] = useState("governor");
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="grid min-h-[540px] overflow-hidden rounded-md border border-zinc-800 bg-[#050506] xl:grid-cols-[1fr_220px]">
      <div className="relative min-h-[540px] overflow-hidden">
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(#27272a_1px,transparent_1px),linear-gradient(90deg,#27272a_1px,transparent_1px)] [background-size:24px_24px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            return (
              <path
                d={edgePath(from, to)}
                fill="none"
                key={edge.id}
                stroke={edge.active ? "#34d399" : "#52525b"}
                strokeDasharray={edge.active ? "0" : "1.4 1.4"}
                strokeLinecap="round"
                strokeWidth={edge.active ? 0.42 : 0.25}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <div className="relative z-[1] px-5 py-4">
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">[ live orchestration ]</div>
          <div className="mt-1 text-sm text-zinc-300">Generated from repos, tasks, approvals, runtimes, and PR state</div>
        </div>
        {nodes.map((node) => (
          <button
            className={`absolute z-[1] w-[116px] rounded-md border bg-black/95 px-3 py-2 text-left text-sm shadow-[0_0_30px_rgba(0,0,0,0.45)] transition hover:border-zinc-300 sm:w-[128px] ${
              kindTone[node.kind]
            } ${selected.id === node.id ? "ring-1 ring-white/60" : ""} ${node.active ? "" : "opacity-55"}`}
            key={node.id}
            onClick={() => setSelectedId(node.id)}
            style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
            type="button"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${kindDot[node.kind]} ${node.active ? "animate-pulse" : ""}`} />
              <span className="min-w-0 truncate font-medium">{node.label}</span>
            </div>
            <div className="mt-1 truncate font-mono text-[10px] uppercase text-zinc-500">{node.meta}</div>
          </button>
        ))}
      </div>

      <aside className="border-t border-zinc-800 bg-black/70 p-4 xl:border-l xl:border-t-0">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">selected node</div>
        <div className={`mt-3 rounded-md border bg-zinc-950 p-3 ${kindTone[selected.kind]}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${kindDot[selected.kind]}`} />
            <div className="truncate text-sm font-semibold">{selected.label}</div>
          </div>
          <div className="mt-3 text-sm text-zinc-300">{selected.detail}</div>
          <div className="mt-3 rounded bg-black px-2 py-1 font-mono text-[11px] uppercase text-zinc-500">{selected.meta}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="repos" value={repos.length} />
          <MiniStat label="tasks" value={tasks.length} />
          <MiniStat label="runtimes" value={runtimes.filter((runtime) => runtime.enabled).length} />
          <MiniStat label="gates" value={approvals.filter((approval) => approval.status !== "APPROVED").length} />
        </div>
        <div className="mt-4 space-y-2">
          {(["input", "repo", "task", "runtime", "approval", "pr"] as NodeKind[]).map((kind) => (
            <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs" key={kind}>
              <span className="capitalize text-zinc-400">{kind}</span>
              <span className={`h-2 w-2 rounded-full ${kindDot[kind]}`} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black px-3 py-2">
      <div className="font-mono text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

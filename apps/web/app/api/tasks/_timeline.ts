import { loadConfig } from "@agent-governor/config";
import { migrate, openDb, type GovernorDb } from "@agent-governor/db";

export type TaskTimelineEvent = {
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

export type TaskProgressSnapshot = {
  ok: boolean;
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
    type: "approval_required" | "worker_pending" | "running" | "open_pr" | "done" | "failed" | "none";
    stage: string | null;
    label: string;
  };
  links: {
    progressUrl: string;
    prUrl: string | null;
    eventsUrl: string;
    streamUrl: string;
  };
  events: TaskTimelineEvent[];
};

type TaskRow = {
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
};

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stageFromWaitingStatus(status: string): string | null {
  if (status === "WAITING_REQUIREMENTS_APPROVAL") return "requirements";
  if (status === "WAITING_DESIGN_APPROVAL") return "design";
  if (status === "WAITING_PR_APPROVAL") return "pr";
  if (status === "WAITING_MERGE_APPROVAL") return "merge";
  return null;
}

function nextActionFor(task: TaskRow | null, approvedStages: Set<string>): TaskProgressSnapshot["nextAction"] {
  if (!task) {
    return { type: "none", stage: null, label: "Task not found" };
  }
  if (task.status === "FAILED" || task.status === "REJECTED") {
    return { type: "failed", stage: task.stage, label: task.status === "FAILED" ? "Task failed" : "Task rejected" };
  }
  if (task.status === "MERGED") {
    return { type: "done", stage: "merge", label: "Merged" };
  }
  if (task.status === "PR_OPENED") {
    return { type: "done", stage: "pr", label: "Pull request opened" };
  }
  if (["REQUIREMENTS_GENERATING", "DESIGN_GENERATING", "IMPLEMENTING", "REVIEWING", "TESTING", "FIXING"].includes(task.status)) {
    return { type: "running", stage: task.stage, label: `Running ${task.stage ?? "task"}` };
  }
  const waitingStage = stageFromWaitingStatus(task.status);
  if (waitingStage && !approvedStages.has(waitingStage)) {
    return { type: "approval_required", stage: waitingStage, label: `Approval required: ${waitingStage}` };
  }
  if (waitingStage === "pr" && approvedStages.has("pr")) {
    return { type: "open_pr", stage: "pr", label: "Worker can open the pull request" };
  }
  if (waitingStage) {
    return { type: "worker_pending", stage: waitingStage, label: `Worker can continue after ${waitingStage} approval` };
  }
  return { type: "worker_pending", stage: task.stage, label: "Waiting for a worker node" };
}

function labelForEvent(type: string): string {
  if (type.startsWith("approval.")) return "Approval";
  if (type.startsWith("run.")) return "Runtime";
  if (type.startsWith("worker.") || type.startsWith("task.claimed") || type.startsWith("claim.")) return "Worker";
  if (type.startsWith("task.")) return "Task";
  if (type.startsWith("pr.")) return "Pull Request";
  return "Event";
}

export function buildTaskProgressSnapshot(taskId: number, origin = ""): TaskProgressSnapshot {
  const config = loadConfig(process.cwd());
  const db = openDb(config.app.paths.database);
  try {
    migrate(db);
    return buildTaskProgressSnapshotFromDb(db, taskId, origin);
  } finally {
    db.close();
  }
}

export function buildTaskProgressSnapshotFromDb(db: GovernorDb, taskId: number, origin = ""): TaskProgressSnapshot {
  const task = db.prepare(`
    SELECT tasks.id,
           tasks.title,
           tasks.description,
           repos.name AS repo,
           tasks.status,
           tasks.current_stage AS stage,
           tasks.branch_name AS branch,
           tasks.pr_url AS prUrl,
           tasks.created_at AS createdAt,
           tasks.updated_at AS updatedAt
    FROM tasks
    JOIN repos ON repos.id = tasks.repo_id
    WHERE tasks.id = ?
  `).get(taskId) as TaskRow | undefined;

  const events: TaskTimelineEvent[] = [];
  const approvedStages = new Set<string>();
  if (task) {
    events.push({
      id: `task-${task.id}-created`,
      type: "task.created",
      label: "Task",
      message: `TASK-${task.id} created: ${task.title}`,
      taskId: task.id,
      stage: null,
      status: task.status,
      actorType: "user",
      actorId: null,
      createdAt: task.createdAt,
      metadata: { repo: task.repo }
    });

    const approvals = db.prepare(`
      SELECT id, stage, status, approved_by AS approvedBy, requested_by AS requestedBy, comment, created_at AS createdAt
      FROM approvals
      WHERE task_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(task.id) as Array<{ id: number; stage: string; status: string; approvedBy: string | null; requestedBy: string | null; comment: string | null; createdAt: string }>;
    for (const approval of approvals) {
      if (approval.status === "approved") {
        approvedStages.add(approval.stage);
      }
      events.push({
        id: `approval-${approval.id}`,
        type: `approval.${approval.status}`,
        label: "Approval",
        message: `${approval.stage} ${approval.status}${approval.approvedBy ? ` by ${approval.approvedBy}` : ""}`,
        taskId: task.id,
        stage: approval.stage,
        status: approval.status,
        actorType: "owner",
        actorId: approval.approvedBy ?? approval.requestedBy,
        createdAt: approval.createdAt,
        metadata: { comment: approval.comment }
      });
    }

    const runs = db.prepare(`
      SELECT id, stage, role, runtime_id AS runtimeId, status, started_at AS startedAt, finished_at AS finishedAt,
             error, task_type AS taskType, latency_ms AS latencyMs, estimated_cost_usd AS estimatedCostUsd
      FROM agent_runs
      WHERE task_id = ?
      ORDER BY started_at ASC, id ASC
    `).all(task.id) as Array<{ id: number; stage: string; role: string; runtimeId: string; status: string; startedAt: string; finishedAt: string | null; error: string | null; taskType: string | null; latencyMs: number | null; estimatedCostUsd: number | null }>;
    for (const run of runs) {
      events.push({
        id: `run-${run.id}-started`,
        type: "run.started",
        label: "Runtime",
        message: `${run.runtimeId} started ${run.stage}`,
        taskId: task.id,
        stage: run.stage,
        status: "running",
        actorType: "runtime",
        actorId: run.runtimeId,
        createdAt: run.startedAt,
        metadata: { role: run.role, taskType: run.taskType }
      });
      events.push({
        id: `run-${run.id}-${run.status}`,
        type: run.status === "success" ? "run.completed" : "run.failed",
        label: "Runtime",
        message: run.status === "success" ? `${run.runtimeId} completed ${run.stage}` : `${run.runtimeId} failed ${run.stage}: ${run.error ?? "unknown error"}`,
        taskId: task.id,
        stage: run.stage,
        status: run.status,
        actorType: "runtime",
        actorId: run.runtimeId,
        createdAt: run.finishedAt ?? run.startedAt,
        metadata: { error: run.error, latencyMs: run.latencyMs, estimatedCostUsd: run.estimatedCostUsd }
      });
    }

    const workerEvents = db.prepare(`
      SELECT worker_events.id,
             worker_events.node_id AS nodeId,
             worker_nodes.name AS nodeName,
             worker_events.event_type AS eventType,
             worker_events.message,
             worker_events.metadata_json AS metadataJson,
             worker_events.created_at AS createdAt
      FROM worker_events
      LEFT JOIN worker_nodes ON worker_nodes.id = worker_events.node_id
      WHERE worker_events.task_id = ?
      ORDER BY worker_events.created_at ASC, worker_events.id ASC
    `).all(task.id) as Array<{ id: number; nodeId: string; nodeName: string | null; eventType: string; message: string; metadataJson: string; createdAt: string }>;
    for (const event of workerEvents) {
      events.push({
        id: `worker-${event.id}`,
        type: event.eventType,
        label: labelForEvent(event.eventType),
        message: event.message,
        taskId: task.id,
        stage: typeof parseMetadata(event.metadataJson).currentStage === "string" ? parseMetadata(event.metadataJson).currentStage as string : null,
        status: null,
        actorType: "worker",
        actorId: event.nodeName ?? event.nodeId,
        createdAt: event.createdAt,
        metadata: parseMetadata(event.metadataJson)
      });
    }

    const requiredStage = stageFromWaitingStatus(task.status);
    if (requiredStage && !approvedStages.has(requiredStage)) {
      events.push({
        id: `required-${task.id}-${requiredStage}`,
        type: "input.required",
        label: "Input Required",
        message: `Owner approval required for ${requiredStage}`,
        taskId: task.id,
        stage: requiredStage,
        status: task.status,
        actorType: "system",
        actorId: "governor",
        createdAt: task.updatedAt,
        metadata: { action: "approve", stage: requiredStage }
      });
    }

    if (task.prUrl) {
      events.push({
        id: `pr-${task.id}`,
        type: "pr.opened",
        label: "Pull Request",
        message: `Pull request opened: ${task.prUrl}`,
        taskId: task.id,
        stage: "pr",
        status: "PR_OPENED",
        actorType: "system",
        actorId: "governor",
        createdAt: task.updatedAt,
        metadata: { prUrl: task.prUrl }
      });
    }
  }

  const sorted = events.sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  });

  const base = origin.replace(/\/$/, "");
  return {
    ok: Boolean(task),
    task: task ?? null,
    nextAction: nextActionFor(task ?? null, approvedStages),
    links: {
      progressUrl: `${base}/tasks/${taskId}`,
      prUrl: task?.prUrl ?? null,
      eventsUrl: `${base}/api/tasks/${taskId}/events`,
      streamUrl: `${base}/api/tasks/${taskId}/events?stream=true`
    },
    events: sorted
  };
}

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

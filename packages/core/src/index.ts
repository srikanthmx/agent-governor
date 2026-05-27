export const TASK_STATUSES = [
  "NEW",
  "CONTEXT_READY",
  "REQUIREMENTS_GENERATING",
  "WAITING_REQUIREMENTS_APPROVAL",
  "DESIGN_GENERATING",
  "WAITING_DESIGN_APPROVAL",
  "IMPLEMENTING",
  "TESTING",
  "REVIEWING",
  "FIXING",
  "PR_READY",
  "WAITING_PR_APPROVAL",
  "PR_OPENED",
  "WAITING_MERGE_APPROVAL",
  "MERGED",
  "REJECTED",
  "FAILED"
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type RuntimeType = "shell" | "opencode" | "cline" | "aider" | "hermes" | "api";
export type RuntimeRunStatus = "success" | "failed" | "cancelled";
export type ExpectedOutput = "markdown" | "diff" | "review" | "json";

export interface RuntimeHealth {
  ok: boolean;
  message: string;
  checkedAt: string;
}

export interface RuntimeRunInput {
  taskId: string;
  repoId: string;
  repoPath: string;
  worktreePath: string;
  stage: string;
  role: string;
  model?: string;
  prompt: string;
  contextFiles: string[];
  expectedOutput: ExpectedOutput;
  outputPath?: string;
}

export interface RuntimeRunResult {
  runId: string;
  runtimeId?: string;
  status: RuntimeRunStatus;
  artifacts: string[];
  logsPath: string;
  summary?: string;
  error?: string;
}

export interface RuntimeAdapter {
  id: string;
  label: string;
  type: RuntimeType;
  capabilities: string[];
  healthCheck(): Promise<RuntimeHealth>;
  run(input: RuntimeRunInput): Promise<RuntimeRunResult>;
  cancel?(runId: string): Promise<void>;
}

export interface RepoRecord {
  id: number;
  name: string;
  github_owner: string;
  github_repo: string;
  default_branch: string;
  local_path: string;
  active: number;
  created_at: string;
}

export interface TaskRecord {
  id: number;
  repo_id: number;
  created_by: string;
  title: string;
  description: string;
  status: TaskStatus;
  workflow: string;
  current_stage: string | null;
  branch_name: string | null;
  worktree_path: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export function assertTaskId(value: string): string {
  if (!/^(TASK-)?\d+$/i.test(value)) {
    throw new Error(`Invalid task id: ${value}`);
  }
  return value.toUpperCase().startsWith("TASK-") ? value.toUpperCase() : `TASK-${value}`;
}

export function sanitizeBranchSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "task";
}

export function taskBranchName(taskId: string, title: string): string {
  return `agent/${assertTaskId(taskId)}-${sanitizeBranchSegment(title)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

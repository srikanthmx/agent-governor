import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import type { GovernorConfig } from "@agent-governor/config";
import { nowIso, type RuntimeAdapter, type RuntimeType, type TaskRecord, type TaskStatus } from "@agent-governor/core";
import { ApprovalEngine, audit, type GovernorDb, RepoRegistry, TaskStore } from "@agent-governor/db";
import { GitWorktreeManager, initAiDirectory } from "@agent-governor/git";
import { GhCliManager } from "@agent-governor/github";
import { PlaceholderAdapter, RuntimeRouter, ShellAdapter } from "@agent-governor/runtime";

type StageId = "requirements" | "design" | "implementation" | "review" | "pr";

interface WorkflowStage {
  id: StageId;
  role: string;
  capability?: string;
  approvalRequired?: boolean;
  expectedOutput?: "markdown" | "diff" | "review" | "json";
  artifact?: string;
}

const REQUIREMENTS_TEMPLATE = `# Requirements: <Feature Name>

## Summary
## Problem
## Goals
## Non-goals
## User Stories
## Functional Requirements
## Non-functional Requirements
## Acceptance Criteria
## Edge Cases
## Open Questions
## Approval
- Status:
- Approved By:
- Approved At:
`;

const DESIGN_TEMPLATE = `# Design: <Feature Name>

## Context
## Proposed Approach
## System Flow
## Data Model Changes
## API Changes
## UI Changes
## Files Likely to Change
## Test Plan
## Risks
## Rollback Plan
## Approval
- Status:
- Approved By:
- Approved At:
`;

const IMPLEMENTATION_TEMPLATE = `# Implementation Run

## Scope
Implement only the approved task.

## Required Output
Summarize changed files, tests run, and any follow-up risks.
`;

function taskLabel(taskId: number): string {
  return `TASK-${taskId}`;
}

function taskDir(worktreePath: string, taskId: number): string {
  return join(worktreePath, ".ai", "tasks", taskLabel(taskId));
}

function ensureTaskArtifacts(worktreePath: string, task: TaskRecord): void {
  initAiDirectory(worktreePath);
  const dir = taskDir(worktreePath, task.id);
  mkdirSync(join(dir, "agent-runs"), { recursive: true });
  mkdirSync(join(dir, "logs"), { recursive: true });
  const files: Record<string, string> = {
    "requirements.md": REQUIREMENTS_TEMPLATE.replace("<Feature Name>", task.title),
    "design.md": DESIGN_TEMPLATE.replace("<Feature Name>", task.title),
    "implementation-plan.md": `# Implementation Plan: ${task.title}\n\n## Steps\n`,
    "review.md": `# Review: ${task.title}\n\n## Findings\n`,
    "decision-log.md": `# Decision Log: ${task.title}\n\n`
  };
  for (const [file, content] of Object.entries(files)) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      writeFileSync(path, content);
    }
  }
}

function hasSourceChanges(worktreePath: string): boolean {
  const result = spawnSync("git", ["-C", worktreePath, "status", "--porcelain", "--", ".", ":!.ai"], {
    encoding: "utf8"
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function stagesFor(config: GovernorConfig, workflowName: string): WorkflowStage[] {
  const workflows = config.workflows.workflows as Record<string, { stages?: WorkflowStage[] }>;
  return workflows[workflowName]?.stages ?? workflows.default?.stages ?? [];
}

function buildAdapters(config: GovernorConfig): RuntimeAdapter[] {
  return config.agents.agents
    .filter((agent) => agent.enabled)
    .map((agent) => {
      if (agent.command && (agent.type === "shell" || agent.type === "opencode" || agent.type === "api")) {
        return new ShellAdapter({
          id: agent.id,
          label: agent.label,
          type: agent.type as RuntimeType,
          command: agent.command,
          args: agent.args,
          capabilities: agent.capabilities,
          logsRoot: config.app.paths.logs
        });
      }
      return new PlaceholderAdapter(agent.id, agent.label, agent.type as RuntimeType, agent.capabilities);
    });
}

function promptFor(stage: StageId, task: TaskRecord, artifactTemplate: string): string {
  return [
    `You are working inside Agent Governor on ${taskLabel(task.id)}.`,
    `Task title: ${task.title}`,
    `Task description:\n${task.description}`,
    "",
    `Stage: ${stage}`,
    "Write only the requested artifact content. Keep it concrete and implementation-oriented.",
    "",
    artifactTemplate
  ].join("\n");
}

function generatingStatus(stage: StageId): TaskStatus {
  if (stage === "requirements") {
    return "REQUIREMENTS_GENERATING";
  }
  if (stage === "design") {
    return "DESIGN_GENERATING";
  }
  if (stage === "implementation") {
    return "IMPLEMENTING";
  }
  if (stage === "review") {
    return "REVIEWING";
  }
  return "PR_READY";
}

function taskTypeFor(stage: StageId, capability: string): string {
  if (stage === "requirements") return "repo_analysis";
  if (stage === "design") return "planning";
  if (stage === "implementation") return capability === "implementation" ? "implementation" : capability;
  if (stage === "review") return "review";
  return stage;
}

export class WorkflowEngine {
  private readonly tasks: TaskStore;
  private readonly repos: RepoRegistry;
  private readonly approvals: ApprovalEngine;
  private readonly git = new GitWorktreeManager();

  constructor(private readonly input: { db: GovernorDb; config: GovernorConfig }) {
    this.tasks = new TaskStore(input.db);
    this.repos = new RepoRegistry(input.db);
    this.approvals = new ApprovalEngine(input.db, input.config.app.telegram.ownerTelegramIds);
  }

  registerRepo(input: {
    name: string;
    githubOwner: string;
    githubRepo: string;
    localPath: string;
    defaultBranch?: string;
    owners?: string[];
  }) {
    if (existsSync(input.localPath)) {
      initAiDirectory(input.localPath);
    }
    const repo = this.repos.addRepo({
      name: input.name,
      githubOwner: input.githubOwner,
      githubRepo: input.githubRepo,
      defaultBranch: input.defaultBranch ?? this.input.config.app.github.defaultBranch,
      localPath: input.localPath,
      owners: input.owners
    });
    audit(this.input.db, {
      actorType: "system",
      actorId: "repo-registry",
      action: "repo.register",
      entityType: "repo",
      entityId: String(repo.id),
      metadata: { name: repo.name, localPath: repo.local_path }
    });
    return repo;
  }

  async cloneRepo(input: {
    name: string;
    githubOwner: string;
    githubRepo: string;
    localPath?: string;
    defaultBranch?: string;
    owners?: string[];
  }) {
    const localPath = input.localPath ?? join(this.input.config.app.paths.repoRoot, input.name, "main");
    if (!existsSync(localPath)) {
      await new GhCliManager().cloneRepo({ owner: input.githubOwner, repo: input.githubRepo, path: localPath });
    }
    initAiDirectory(localPath);
    return this.registerRepo({
      name: input.name,
      githubOwner: input.githubOwner,
      githubRepo: input.githubRepo,
      localPath,
      defaultBranch: input.defaultBranch,
      owners: input.owners
    });
  }

  async createGithubRepo(input: {
    name: string;
    description?: string;
    owner?: string;
    private?: boolean;
    owners?: string[];
  }) {
    const githubOwner = input.owner ?? this.input.config.app.github.owner;
    if (!githubOwner) {
      throw new Error("GitHub owner is required");
    }
    await new GhCliManager().createRepo({
      owner: githubOwner,
      name: input.name,
      description: input.description,
      private: input.private
    });
    return this.cloneRepo({
      name: input.name,
      githubOwner,
      githubRepo: input.name,
      owners: input.owners
    });
  }

  async syncGithubRepos(input?: { owner?: string; limit?: number }) {
    const owner = input?.owner;
    const repos = await new GhCliManager().listRepos({ owner, limit: input?.limit });
    this.repos.upsertGithubRepos(repos);
    audit(this.input.db, {
      actorType: "system",
      actorId: "github",
      action: "github.repos.sync",
      entityType: "github_repos",
      entityId: owner ?? "viewer",
      metadata: { count: repos.length }
    });
    return repos;
  }

  async advance(taskId: number, actorId = "cli", options?: { runtimeId?: string; model?: string }): Promise<TaskRecord> {
    const task = this.tasks.getTask(taskId);
    const repo = this.repos.getRepo(task.repo_id);
    const workflowStages = stagesFor(this.input.config, task.workflow);

    const worktreePath = task.worktree_path ?? join(dirname(repo.local_path), "worktrees", taskLabel(task.id));
    let branchName = task.branch_name;
    if (!branchName) {
      if (!existsSync(repo.local_path)) {
        throw new Error(`Repo local path does not exist: ${repo.local_path}`);
      }
      branchName = await this.git.createWorktree({
        repoPath: repo.local_path,
        worktreePath,
        taskId: taskLabel(task.id),
        title: task.title
      });
      this.tasks.setExecutionContext(task.id, { branchName, worktreePath });
    }

    ensureTaskArtifacts(worktreePath, task);

    if (task.status === "NEW" || task.status === "CONTEXT_READY") {
      await this.runArtifactStage({ task, stage: "requirements", status: "WAITING_REQUIREMENTS_APPROVAL", worktreePath, workflowStages, runtimeId: options?.runtimeId, model: options?.model });
      return this.tasks.getTask(task.id);
    }

    if (task.status === "WAITING_REQUIREMENTS_APPROVAL") {
      if (!this.approvals.hasApproval(task.id, "requirements")) {
        throw new Error(`TASK-${task.id} is waiting for requirements approval`);
      }
      await this.runArtifactStage({ task, stage: "design", status: "WAITING_DESIGN_APPROVAL", worktreePath, workflowStages, runtimeId: options?.runtimeId, model: options?.model });
      return this.tasks.getTask(task.id);
    }

    if (task.status === "WAITING_DESIGN_APPROVAL") {
      if (!this.approvals.hasApproval(task.id, "design")) {
        throw new Error(`TASK-${task.id} is waiting for design approval`);
      }
      await this.runArtifactStage({ task, stage: "implementation", status: "WAITING_PR_APPROVAL", worktreePath, workflowStages, runtimeId: options?.runtimeId, model: options?.model });
      audit(this.input.db, { actorType: "system", actorId, action: "task.ready_for_pr", entityType: "task", entityId: String(task.id) });
      return this.tasks.getTask(task.id);
    }

    return task;
  }

  async approve(taskId: number, stage: string, ownerId: string, comment?: string): Promise<TaskRecord> {
    const task = this.tasks.getTask(taskId);
    this.approvals.approve(taskId, stage, ownerId, comment);
    audit(this.input.db, {
      actorType: "owner",
      actorId: ownerId,
      action: "task.approve",
      entityType: "task",
      entityId: String(taskId),
      metadata: { stage, comment }
    });
    return task;
  }

  async reject(taskId: number, stage: string, ownerId: string, comment?: string): Promise<TaskRecord> {
    const task = this.tasks.getTask(taskId);
    this.approvals.reject(taskId, stage, ownerId, comment);
    this.tasks.updateStatus(taskId, "REJECTED", stage);
    audit(this.input.db, {
      actorType: "owner",
      actorId: ownerId,
      action: "task.reject",
      entityType: "task",
      entityId: String(taskId),
      metadata: { stage, comment }
    });
    return this.tasks.getTask(task.id);
  }

  async requestChanges(taskId: number, stage: string, ownerId: string, feedback: string): Promise<TaskRecord> {
    const task = this.tasks.getTask(taskId);
    this.approvals.requireOwner(ownerId, task.repo_id);
    this.tasks.updateStatus(taskId, "FIXING", stage);
    audit(this.input.db, {
      actorType: "owner",
      actorId: ownerId,
      action: "task.change_requested",
      entityType: "task",
      entityId: String(taskId),
      metadata: { stage, feedback }
    });
    return this.tasks.getTask(task.id);
  }

  async openPullRequest(taskId: number, ownerId: string, input?: { title?: string; body?: string }): Promise<TaskRecord> {
    const task = this.tasks.getTask(taskId);
    const repo = this.repos.getRepo(task.repo_id);
    this.approvals.requireOwner(ownerId, task.repo_id);
    if (!this.approvals.hasApproval(task.id, "pr")) {
      throw new Error(`TASK-${task.id} needs PR approval before opening a PR`);
    }
    if (!task.worktree_path || !task.branch_name) {
      throw new Error(`TASK-${task.id} has no worktree or branch yet`);
    }
    await this.git.commitAll({ cwd: task.worktree_path, message: `TASK-${task.id}: ${task.title}` });
    await this.git.pushBranch({ cwd: task.worktree_path, branch: task.branch_name });
    const prUrl = await new GhCliManager().createPullRequest({
      cwd: task.worktree_path,
      title: input?.title ?? `TASK-${task.id}: ${task.title}`,
      body: input?.body ?? task.description,
      base: repo.default_branch,
      head: task.branch_name
    });
    this.tasks.setExecutionContext(task.id, { prUrl });
    this.tasks.updateStatus(task.id, "PR_OPENED", "pr");
    audit(this.input.db, {
      actorType: "owner",
      actorId: ownerId,
      action: "pr.open",
      entityType: "task",
      entityId: String(task.id),
      metadata: { prUrl }
    });
    return this.tasks.getTask(task.id);
  }

  async mergePullRequest(taskId: number, ownerId: string): Promise<TaskRecord> {
    const task = this.tasks.getTask(taskId);
    this.approvals.requireOwner(ownerId, task.repo_id);
    if (!this.approvals.hasApproval(task.id, "merge")) {
      throw new Error(`TASK-${task.id} needs merge approval before merge`);
    }
    if (!task.worktree_path || !task.pr_url) {
      throw new Error(`TASK-${task.id} has no opened PR`);
    }
    await new GhCliManager().mergePullRequest({ cwd: task.worktree_path, pr: task.pr_url, method: "squash" });
    this.tasks.updateStatus(task.id, "MERGED", "merge");
    audit(this.input.db, {
      actorType: "owner",
      actorId: ownerId,
      action: "pr.merge",
      entityType: "task",
      entityId: String(task.id),
      metadata: { prUrl: task.pr_url }
    });
    return this.tasks.getTask(task.id);
  }

  private async runArtifactStage(input: {
    task: TaskRecord;
    stage: StageId;
    status: TaskStatus;
    worktreePath: string;
    workflowStages: WorkflowStage[];
    runtimeId?: string;
    model?: string;
  }): Promise<void> {
    const stageConfig = input.workflowStages.find((stage) => stage.id === input.stage);
    if (!stageConfig) {
      throw new Error(`Workflow stage is not configured: ${input.stage}`);
    }
    const configuredRoles = this.input.config.agents.roles[stageConfig.role] ?? { preferred: ["shell"], fallback: [] };
    const roles = input.runtimeId
      ? {
          preferred: [input.runtimeId],
          fallback: [...configuredRoles.preferred, ...configuredRoles.fallback].filter((id) => id !== input.runtimeId)
        }
      : configuredRoles;
    const router = new RuntimeRouter(buildAdapters(this.input.config));
    const outputPath = stageConfig.artifact
      ? join(taskDir(input.worktreePath, input.task.id), stageConfig.artifact)
      : join(taskDir(input.worktreePath, input.task.id), `${input.stage}.md`);
    const startedAt = nowIso();
    this.tasks.updateStatus(input.task.id, generatingStatus(input.stage), input.stage);
    const result = await router.runWithFallback({
      preferred: roles.preferred,
      fallback: roles.fallback,
      capability: stageConfig.capability ?? input.stage,
      runInput: {
        taskId: taskLabel(input.task.id),
        repoId: String(input.task.repo_id),
        repoPath: input.worktreePath,
        worktreePath: input.worktreePath,
        stage: input.stage,
        role: stageConfig.role,
        model: input.model,
        prompt: promptFor(
          input.stage,
          input.task,
          input.stage === "design"
            ? DESIGN_TEMPLATE
            : input.stage === "implementation"
              ? IMPLEMENTATION_TEMPLATE
              : REQUIREMENTS_TEMPLATE
        ),
        contextFiles: [],
        expectedOutput: stageConfig.expectedOutput ?? "markdown",
        outputPath
      }
    });
    const taskType = taskTypeFor(input.stage, stageConfig.capability ?? input.stage);
    const fallbackPath = [...roles.preferred, ...roles.fallback];
    let status = result.status;
    let error = result.error;
    if (input.stage === "implementation" && result.status === "success" && !hasSourceChanges(input.worktreePath)) {
      status = "failed";
      error = "Implementation completed without source changes outside .ai. Review the CLI output and run implementation again.";
    }

    this.tasks.recordAgentRun({
      taskId: input.task.id,
      stage: input.stage,
      role: stageConfig.role,
      runtimeId: result.runtimeId ?? result.runId,
      status,
      logsPath: result.logsPath,
      startedAt,
      finishedAt: nowIso(),
      error,
      taskType,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
      fallbackPath,
      routeAttempts: result.routeAttempts ?? []
    });
    audit(this.input.db, {
      actorType: "system",
      actorId: "runtime-router",
      action: "runtime.execution",
      entityType: "task",
      entityId: String(input.task.id),
      metadata: {
        stage: input.stage,
        taskType,
        runtimeId: result.runtimeId,
        status,
        latencyMs: result.latencyMs,
        estimatedCostUsd: result.estimatedCostUsd,
        fallbackPath,
        routeAttempts: result.routeAttempts ?? []
      }
    });
    if (status !== "success") {
      this.tasks.updateStatus(input.task.id, "FAILED", input.stage);
      throw new Error(error ?? `${input.stage} failed`);
    }
    this.tasks.updateStatus(input.task.id, input.status, input.stage);
  }
}

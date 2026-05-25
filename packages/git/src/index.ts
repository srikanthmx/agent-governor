import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { taskBranchName } from "@agent-governor/core";

export class GitWorktreeManager {
  async clone(input: { url: string; path: string; branch?: string }): Promise<void> {
    mkdirSync(resolve(input.path, ".."), { recursive: true });
    const args = ["clone"];
    if (input.branch) {
      args.push("--branch", input.branch);
    }
    args.push(input.url, input.path);
    await execa("git", args, { stdio: "inherit" });
  }

  async createWorktree(input: { repoPath: string; worktreePath: string; taskId: string; title: string }): Promise<string> {
    const branch = taskBranchName(input.taskId, input.title);
    mkdirSync(resolve(input.worktreePath, ".."), { recursive: true });
    if (existsSync(input.worktreePath)) {
      return branch;
    }
    await execa("git", ["worktree", "prune"], { cwd: input.repoPath, reject: false });
    const existingBranch = await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
      cwd: input.repoPath,
      reject: false
    });
    const args = existingBranch.exitCode === 0
      ? ["worktree", "add", input.worktreePath, branch]
      : ["worktree", "add", "-b", branch, input.worktreePath];
    await execa("git", args, {
      cwd: input.repoPath,
      stdio: "inherit"
    });
    return branch;
  }

  async commitAll(input: { cwd: string; message: string }): Promise<void> {
    await this.assertGitWorktree(input.cwd);
    await execa("git", ["add", "."], { cwd: input.cwd });
    const status = await execa("git", ["status", "--porcelain"], { cwd: input.cwd });
    if (status.stdout.trim().length === 0) {
      return;
    }
    await execa("git", ["commit", "-m", input.message], { cwd: input.cwd, stdio: "inherit" });
  }

  async pushBranch(input: { cwd: string; branch: string }): Promise<void> {
    if (input.branch === "main" || input.branch === "master") {
      throw new Error("Refusing to push directly to the default branch");
    }
    await this.assertGitWorktree(input.cwd);
    await execa("git", ["push", "-u", "origin", input.branch], { cwd: input.cwd, stdio: "inherit" });
  }

  async assertGitWorktree(cwd: string): Promise<void> {
    await execa("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
  }
}

export function initAiDirectory(repoPath: string): void {
  const aiPath = join(repoPath, ".ai");
  mkdirSync(join(aiPath, "tasks"), { recursive: true });
  const files: Record<string, string> = {
    "project.md": "# Project\n\nDescribe this repository for governed agent work.\n",
    "agent-rules.md": "# Agent Rules\n\n- Do not push directly to main.\n- Keep changes scoped to the approved task.\n",
    "architecture.md": "# Architecture\n\nDocument the system architecture here.\n",
    "coding-standards.md": "# Coding Standards\n\nDocument local conventions here.\n",
    "workflows.yml": "workflows:\n  default: {}\n",
    "skills.md": "# Skills\n\nDocument project-specific skills here.\n",
    "approval.yml": "approvals:\n  requirements: owner\n  design: owner\n  pr: owner\n  merge: owner\n"
  };
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(aiPath, name);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content);
    }
  }
}

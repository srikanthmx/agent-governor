import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
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
    await execa("git", ["worktree", "add", "-b", branch, input.worktreePath], {
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

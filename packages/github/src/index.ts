import { execa } from "execa";

export interface GitHubManager {
  createRepo(input: { owner?: string; name: string; description?: string; private?: boolean }): Promise<string>;
  cloneRepo(input: { owner: string; repo: string; path: string }): Promise<void>;
  createPullRequest(input: { cwd: string; title: string; body: string; base: string; head?: string }): Promise<string>;
  viewPullRequest(input: { cwd: string; pr: string }): Promise<string>;
  mergePullRequest(input: { cwd: string; pr: string; method?: "merge" | "squash" | "rebase" }): Promise<void>;
}

export class GhCliManager implements GitHubManager {
  async createRepo(input: { owner?: string; name: string; description?: string; private?: boolean }): Promise<string> {
    const repoName = input.owner ? `${input.owner}/${input.name}` : input.name;
    const args = ["repo", "create", repoName, input.private === false ? "--public" : "--private"];
    if (input.description) {
      args.push("--description", input.description);
    }
    const result = await execa("gh", args);
    return result.stdout.trim();
  }

  async cloneRepo(input: { owner: string; repo: string; path: string }): Promise<void> {
    await execa("gh", ["repo", "clone", `${input.owner}/${input.repo}`, input.path], { stdio: "inherit" });
  }

  async createPullRequest(input: { cwd: string; title: string; body: string; base: string; head?: string }): Promise<string> {
    const args = ["pr", "create", "--title", input.title, "--body", input.body, "--base", input.base];
    if (input.head) {
      args.push("--head", input.head);
    }
    const result = await execa("gh", args, { cwd: input.cwd });
    return result.stdout.trim();
  }

  async viewPullRequest(input: { cwd: string; pr: string }): Promise<string> {
    const result = await execa("gh", ["pr", "view", input.pr, "--json", "url,state,title,author"], { cwd: input.cwd });
    return result.stdout;
  }

  async mergePullRequest(input: { cwd: string; pr: string; method?: "merge" | "squash" | "rebase" }): Promise<void> {
    await execa("gh", ["pr", "merge", input.pr, `--${input.method ?? "squash"}`], {
      cwd: input.cwd,
      stdio: "inherit"
    });
  }
}

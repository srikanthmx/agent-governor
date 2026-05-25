import { execa } from "execa";

export interface GitHubManager {
  listRepos(input: { owner?: string; limit?: number }): Promise<GitHubRepo[]>;
  createRepo(input: { owner?: string; name: string; description?: string; private?: boolean }): Promise<string>;
  cloneRepo(input: { owner: string; repo: string; path: string }): Promise<void>;
  createPullRequest(input: { cwd: string; title: string; body: string; base: string; head?: string }): Promise<string>;
  viewPullRequest(input: { cwd: string; pr: string }): Promise<string>;
  mergePullRequest(input: { cwd: string; pr: string; method?: "merge" | "squash" | "rebase" }): Promise<void>;
}

export interface GitHubRepo {
  name: string;
  nameWithOwner: string;
  owner: string;
  description: string;
  isPrivate: boolean;
  defaultBranch: string;
  url: string;
  updatedAt: string;
}

export class GhCliManager implements GitHubManager {
  async listRepos(input: { owner?: string; limit?: number }): Promise<GitHubRepo[]> {
    const args = [
      "repo",
      "list",
      input.owner ?? "",
      "--limit",
      String(input.limit ?? 100),
      "--json",
      "name,nameWithOwner,owner,description,isPrivate,defaultBranchRef,url,updatedAt"
    ].filter(Boolean);
    const result = await execa("gh", args);
    const rows = JSON.parse(result.stdout) as Array<{
      name: string;
      nameWithOwner: string;
      owner: { login: string };
      description?: string;
      isPrivate: boolean;
      defaultBranchRef?: { name: string };
      url: string;
      updatedAt: string;
    }>;
    return rows.map((repo) => ({
      name: repo.name,
      nameWithOwner: repo.nameWithOwner,
      owner: repo.owner.login,
      description: repo.description ?? "",
      isPrivate: repo.isPrivate,
      defaultBranch: repo.defaultBranchRef?.name ?? "main",
      url: repo.url,
      updatedAt: repo.updatedAt
    }));
  }

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

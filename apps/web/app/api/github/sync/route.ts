import { loadConfig, projectRoot } from "@agent-governor/config";
import { migrate, openDb, RepoRegistry } from "@agent-governor/db";
import { NextResponse } from "next/server";
import { githubApiHeaders, readStoredGitHubAuth } from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { owner?: string; limit?: number | null };
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0 ? body.limit : undefined;
  const stored = readStoredGitHubAuth();
  if (stored) {
    try {
      const repos = await listReposViaToken({
        accessToken: stored.accessToken,
        owner: body.owner,
        limit
      });
      upsertGithubRepos(repos);
      return NextResponse.json({
        ok: true,
        provider: "github-oauth",
        count: repos.length,
        output: `Synced ${repos.length} GitHub repos through web SSO`
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        provider: "github-oauth",
        count: 0,
        error: error instanceof Error ? error.message : "GitHub web sync failed"
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: false,
    provider: "github-oauth",
    count: 0,
    error: "Sign in with GitHub in the browser before syncing repositories."
  }, { status: 401 });
}

type GithubApiRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
};

async function listReposViaToken(input: { accessToken: string; owner?: string; limit?: number }) {
  const repos: GithubApiRepo[] = [];
  let page = 1;
  while (!input.limit || repos.length < input.limit) {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");
    url.searchParams.set("visibility", "all");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("per_page", String(input.limit ? Math.min(100, input.limit - repos.length) : 100));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: githubApiHeaders(input.accessToken),
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(githubApiError(response, "repo API"));
    }
    const batch = await response.json() as GithubApiRepo[];
    if (batch.length === 0) break;
    repos.push(...batch.filter((repo) => !input.owner || repo.owner.login.toLowerCase() === input.owner.toLowerCase()));
    if (batch.length < 100) break;
    page += 1;
  }

  return (input.limit ? repos.slice(0, input.limit) : repos).map((repo) => ({
    name: repo.name,
    nameWithOwner: repo.full_name,
    owner: repo.owner.login,
    description: repo.description ?? "",
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
    url: repo.html_url,
    updatedAt: repo.updated_at
  }));
}

function githubApiError(response: Response, label: string) {
  const sso = response.headers.get("x-github-sso");
  if (sso) {
    return `GitHub ${label} returned ${response.status}. Organization SSO authorization may be required: ${sso}`;
  }
  return `GitHub ${label} returned ${response.status}`;
}

function upsertGithubRepos(repos: Awaited<ReturnType<typeof listReposViaToken>>) {
  const root = projectRoot(process.cwd());
  const databasePath = loadConfig(root).app.paths.database;
  const db = openDb(databasePath);
  try {
    migrate(db);
    new RepoRegistry(db).upsertGithubRepos(repos);
  } finally {
    db.close();
  }
}

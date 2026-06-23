import { loadConfig } from "@agent-governor/config";
import { migrate, openDb } from "@agent-governor/db";
import { execa } from "execa";
import { NextResponse } from "next/server";
import { githubAppConfigured } from "../_app-token";
import { readGithubUser, readStoredGitHubAuth } from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Array<{ id: string; ok: boolean; label: string; detail: string }> = [];
  const stored = readStoredGitHubAuth();
  if (stored) {
    try {
      const user = await readGithubUser(stored.accessToken);
      checks.push({ id: "auth", ok: true, label: "GitHub auth", detail: `Web SSO authenticated as ${user.login}` });
    } catch (error) {
      checks.push({ id: "auth", ok: false, label: "GitHub auth", detail: error instanceof Error ? error.message : "Stored GitHub token failed" });
    }
  } else {
    const gh = await execa("gh", ["auth", "status", "--hostname", "github.com"], { reject: false }).catch((error) => ({
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error)
    }));
    const output = [gh.stdout, gh.stderr].filter(Boolean).join("\n");
    checks.push({
      id: "auth",
      ok: gh.exitCode === 0,
      label: "GitHub auth",
      detail: gh.exitCode === 0 ? "GitHub CLI is authenticated for github.com" : output || "GitHub CLI is not authenticated"
    });
  }

  const config = loadConfig(process.cwd());
  const db = openDb(config.app.paths.database);
  try {
    migrate(db);
    const cached = db.prepare("SELECT COUNT(*) AS count FROM github_repos").get() as { count: number };
    checks.push({
      id: "repos",
      ok: cached.count > 0,
      label: "Repository sync",
      detail: cached.count > 0 ? `${cached.count} repositories synced` : "No GitHub repositories synced yet"
    });
  } finally {
    db.close();
  }

  checks.push({
    id: "worker-tokens",
    ok: githubAppConfigured() || process.env.AG_DEV_WORKER_GIT_TOKEN_ENABLED === "true",
    label: "Worker PR tokens",
    detail: githubAppConfigured()
      ? "GitHub App installation token minting is configured"
      : process.env.AG_DEV_WORKER_GIT_TOKEN_ENABLED === "true"
        ? "Dev worker Git token mode is enabled"
        : "GitHub App is not configured; remote workers cannot mint short-lived repo tokens yet"
  });

  return NextResponse.json({
    ok: checks.every((check) => check.ok),
    checks
  });
}

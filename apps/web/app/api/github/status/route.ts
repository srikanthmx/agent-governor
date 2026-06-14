import { execa } from "execa";
import { NextResponse } from "next/server";
import { githubOAuthConfigured, readGithubUser, readStoredGitHubAuth } from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stored = readStoredGitHubAuth();
  if (stored) {
    try {
      const user = await readGithubUser(stored.accessToken);
      return NextResponse.json({
        authenticated: true,
        provider: "github-oauth",
        login: user.login,
        avatarUrl: user.avatar_url,
        scope: stored.scope,
        output: `GitHub web SSO authenticated as ${user.login}`
      });
    } catch (error) {
      return NextResponse.json({
        authenticated: false,
        provider: "github-oauth",
        webConfigured: githubOAuthConfigured(),
        error: error instanceof Error ? error.message : "Stored GitHub token is invalid",
        output: "Stored GitHub web token is unavailable or expired."
      });
    }
  }

  try {
    const result = await execa("gh", ["auth", "status"], { reject: false });
    return NextResponse.json({
      authenticated: result.exitCode === 0,
      provider: result.exitCode === 0 ? "gh-cli" : githubOAuthConfigured() ? "github-oauth" : "gh-cli",
      webConfigured: githubOAuthConfigured(),
      output: [result.stdout, result.stderr].filter(Boolean).join("\n")
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      provider: githubOAuthConfigured() ? "github-oauth" : "gh-cli",
      webConfigured: githubOAuthConfigured(),
      error: error instanceof Error ? error.message : "GitHub CLI is unavailable",
      output: githubOAuthConfigured() ? "Use GitHub web SSO to authenticate." : "GitHub CLI is unavailable."
    });
  }
}

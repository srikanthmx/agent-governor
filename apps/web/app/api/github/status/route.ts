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

  return NextResponse.json({
    authenticated: false,
    provider: "github-oauth",
    webConfigured: githubOAuthConfigured(),
    output: githubOAuthConfigured()
      ? "Use GitHub browser sign-in to authenticate."
      : "GitHub browser SSO is not configured."
  });
}

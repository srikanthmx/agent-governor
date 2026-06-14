import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGithubCode,
  githubRedirectUri,
  readGithubUser,
  validGithubState,
  writeStoredGitHubAuth
} from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookies().get("ag_github_oauth_state")?.value;
  const redirectUrl = new URL("/setup", url.origin);

  if (!code || !validGithubState(state, expectedState)) {
    redirectUrl.searchParams.set("github", "error");
    redirectUrl.searchParams.set("message", "Invalid GitHub OAuth response");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const token = await exchangeGithubCode({ code, redirectUri: githubRedirectUri(request) });
    const user = await readGithubUser(token.accessToken);
    writeStoredGitHubAuth({
      ...token,
      login: user.login,
      avatarUrl: user.avatar_url,
      createdAt: new Date().toISOString()
    });
    const response = NextResponse.redirect(new URL("/setup?github=connected", url.origin));
    response.cookies.delete("ag_github_oauth_state");
    return response;
  } catch (error) {
    redirectUrl.searchParams.set("github", "error");
    redirectUrl.searchParams.set("message", error instanceof Error ? error.message : "GitHub OAuth failed");
    return NextResponse.redirect(redirectUrl);
  }
}

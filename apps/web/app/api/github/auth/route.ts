import { NextResponse } from "next/server";
import { createGithubState, githubAuthorizeUrl, githubOAuthConfigured, githubRedirectUri } from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function githubOAuthSetupPayload(request: Request) {
  const callbackUrl = githubRedirectUri(request);
  return {
    pending: false,
    web: true,
    oauthConfigured: false,
    setupRequired: true,
    callbackUrl,
    error: "GitHub browser SSO is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then restart the app.",
    setup: {
      title: "Create a GitHub OAuth App for browser SSO",
      callbackUrl,
      env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
      optionalEnv: ["GITHUB_OAUTH_REDIRECT_URI", "GITHUB_OAUTH_SCOPES"]
    }
  };
}

function githubOAuthResponse(request: Request, pending: boolean) {
  const state = createGithubState();
  const authUrl = githubAuthorizeUrl({ state, redirectUri: githubRedirectUri(request) });
  const response = NextResponse.json({
    pending,
    web: true,
    oauthConfigured: true,
    setupRequired: false,
    authUrl,
    url: authUrl,
    message: "Redirect the browser to GitHub to sign in."
  });
  response.cookies.set("ag_github_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/"
  });
  return response;
}

export async function POST(request: Request) {
  if (!githubOAuthConfigured()) {
    return NextResponse.json(githubOAuthSetupPayload(request));
  }
  return githubOAuthResponse(request, true);
}

export async function GET(request: Request) {
  if (!githubOAuthConfigured()) {
    return NextResponse.json(githubOAuthSetupPayload(request));
  }
  return githubOAuthResponse(request, false);
}

import { spawn } from "node:child_process";
import { execa } from "execa";
import { NextResponse } from "next/server";
import { clearStoredGitHubAuth, createGithubState, githubAuthorizeUrl, githubOAuthConfigured, githubRedirectUri } from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let activeLogin:
  | {
      child: ReturnType<typeof spawn>;
      output: string;
      startedAt: number;
      done: boolean;
      error?: string;
    }
  | undefined;

function parseLoginOutput(output: string): { code?: string; url?: string } {
  return {
    code: output.match(/(?:one-time code|code):\s*([A-Z0-9-]+)/i)?.[1],
    url: output.match(/https:\/\/github\.com\/login\/device[^\s]*/)?.[0]
  };
}

function githubOAuthSetupPayload(request: Request) {
  const callbackUrl = githubRedirectUri(request);
  return {
    pending: false,
    web: true,
    oauthConfigured: false,
    setupRequired: true,
    callbackUrl,
    error: "Optional GitHub OAuth App mode is not configured. For local desktop auth, install GitHub CLI and use browser sign-in.",
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

async function ghAuthStatus() {
  const result = await execa("gh", ["auth", "status", "--hostname", "github.com"], { reject: false });
  return {
    authenticated: result.exitCode === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n")
  };
}

function activeLoginResponse() {
  if (!activeLogin) {
    return NextResponse.json({ pending: false, web: true, provider: "gh-cli" });
  }

  const parsed = parseLoginOutput(activeLogin.output);
  return NextResponse.json({
    ...parsed,
    pending: !activeLogin.done,
    done: activeLogin.done,
    web: true,
    provider: "gh-cli",
    error: activeLogin.error,
    output: activeLogin.output
  });
}

async function openBrowser(url: string) {
  if (process.platform === "darwin") {
    await execa("open", [url], { reject: false });
    return;
  }
  if (process.platform === "win32") {
    await execa("cmd", ["/c", "start", "", url], { reject: false });
    return;
  }
  await execa("xdg-open", [url], { reject: false });
}

export async function POST(request: Request) {
  if (githubOAuthConfigured()) {
    return githubOAuthResponse(request, true);
  }

  try {
    const status = await ghAuthStatus();
    if (status.authenticated) {
      return NextResponse.json({
        authenticated: true,
        pending: false,
        web: true,
        provider: "gh-cli",
        output: status.output,
        message: "GitHub is already authenticated for HTTPS git operations on this machine."
      });
    }
  } catch {
    return NextResponse.json({
      ok: false,
      pending: false,
      web: true,
      provider: "gh-cli",
      error: "GitHub CLI is not installed. Install gh before using local browser authentication."
    }, { status: 400 });
  }

  if (activeLogin && !activeLogin.done && Date.now() - activeLogin.startedAt < 10 * 60 * 1000) {
    return activeLoginResponse();
  }

  const child = spawn("gh", ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  activeLogin = { child, output: "", startedAt: Date.now(), done: false };

  child.stdout.on("data", (chunk: Buffer) => {
    if (activeLogin?.child === child) activeLogin.output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (activeLogin?.child === child) activeLogin.output += chunk.toString("utf8");
  });
  child.on("close", (code) => {
    if (activeLogin?.child === child) {
      activeLogin.done = true;
      if (code !== 0) activeLogin.error = `GitHub browser login exited with ${code}`;
    }
  });

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const parsed = parseLoginOutput(activeLogin.output);
    if (parsed.code || parsed.url) {
      if (parsed.url) {
        await openBrowser(parsed.url);
      }
      return NextResponse.json({ ...parsed, pending: true, web: true, provider: "gh-cli", output: activeLogin.output });
    }
    if (activeLogin.done) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return NextResponse.json({ pending: true, web: true, provider: "gh-cli", output: activeLogin.output });
}

export async function GET(request: Request) {
  if (githubOAuthConfigured()) {
    return githubOAuthResponse(request, false);
  }

  if (activeLogin) return activeLoginResponse();

  try {
    const status = await ghAuthStatus();
    if (status.authenticated) {
      return NextResponse.json({
        authenticated: true,
        pending: false,
        web: true,
        provider: "gh-cli",
        output: status.output
      });
    }
  } catch {
    return NextResponse.json({
      pending: false,
      web: true,
      provider: "gh-cli",
      setupRequired: false,
      error: "GitHub CLI is not installed. Install gh to use local GitHub browser authentication."
    });
  }

  return NextResponse.json({
    pending: false,
    web: true,
    provider: "gh-cli",
    setupRequired: false,
    message: "Use the button to open GitHub browser authentication."
  });
}

export async function DELETE() {
  const removed = clearStoredGitHubAuth();
  const logout = await execa("gh", ["auth", "logout", "--hostname", "github.com", "--yes"], { reject: false }).catch((error) => ({
    exitCode: 1,
    stdout: "",
    stderr: error instanceof Error ? error.message : String(error)
  }));
  const response = NextResponse.json({
    ok: true,
    disconnected: true,
    removed,
    ghLoggedOut: "exitCode" in logout ? logout.exitCode === 0 : false,
    authenticated: false,
    message: removed || ("exitCode" in logout && logout.exitCode === 0)
      ? "GitHub disconnected."
      : "No stored GitHub web token was found, and GitHub CLI was not logged out."
  });
  response.cookies.delete("ag_github_oauth_state");
  return response;
}

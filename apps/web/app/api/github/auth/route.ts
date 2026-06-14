import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { createGithubState, githubAuthorizeUrl, githubOAuthConfigured, githubRedirectUri } from "../_oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let activeLogin:
  | {
      child: ReturnType<typeof spawn>;
      code?: string;
      url?: string;
      output: string;
      startedAt: number;
      done: boolean;
      error?: string;
    }
  | undefined;

function parseLoginOutput(output: string): { code?: string; url?: string } {
  return {
    code: output.match(/one-time code:\s*([A-Z0-9-]+)/i)?.[1],
    url: output.match(/https:\/\/github\.com\/login\/device/)?.[0]
  };
}

export async function POST(request: Request) {
  if (githubOAuthConfigured()) {
    const state = createGithubState();
    const authUrl = githubAuthorizeUrl({ state, redirectUri: githubRedirectUri(request) });
    const response = NextResponse.json({
      pending: true,
      web: true,
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

  if (activeLogin && !activeLogin.done && Date.now() - activeLogin.startedAt < 10 * 60 * 1000) {
    const parsed = parseLoginOutput(activeLogin.output);
    return NextResponse.json({ ...parsed, pending: true, output: activeLogin.output });
  }

  const child = spawn("gh", ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  activeLogin = { child, output: "", startedAt: Date.now(), done: false };

  child.stdout.on("data", (chunk: Buffer) => {
    if (activeLogin?.child === child) {
      activeLogin.output += chunk.toString("utf8");
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (activeLogin?.child === child) {
      activeLogin.output += chunk.toString("utf8");
    }
  });
  child.on("close", (code) => {
    if (activeLogin?.child === child) {
      activeLogin.done = true;
      if (code !== 0) {
        activeLogin.error = `gh auth login exited with ${code}`;
      }
    }
  });

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const parsed = parseLoginOutput(activeLogin.output);
    if (parsed.code && parsed.url) {
      return NextResponse.json({ ...parsed, pending: true, output: activeLogin.output });
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return NextResponse.json({ pending: true, output: activeLogin.output });
}

export async function GET(request: Request) {
  if (githubOAuthConfigured()) {
    const state = createGithubState();
    const authUrl = githubAuthorizeUrl({ state, redirectUri: githubRedirectUri(request) });
    const response = NextResponse.json({
      pending: false,
      web: true,
      authUrl,
      url: authUrl
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

  if (!activeLogin) {
    return NextResponse.json({ pending: false });
  }
  const parsed = parseLoginOutput(activeLogin.output);
  return NextResponse.json({
    ...parsed,
    pending: !activeLogin.done,
    done: activeLogin.done,
    error: activeLogin.error,
    output: activeLogin.output
  });
}

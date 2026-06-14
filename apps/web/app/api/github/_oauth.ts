import { projectRoot } from "@agent-governor/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";

export type StoredGitHubAuth = {
  accessToken: string;
  tokenType: string;
  scope: string;
  login?: string;
  avatarUrl?: string;
  createdAt: string;
};

export type GitHubUser = {
  login: string;
  id: number;
  avatar_url?: string;
};

const stateTtlMs = 10 * 60 * 1000;

export function githubOAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function githubClientId() {
  return process.env.GITHUB_CLIENT_ID;
}

export function githubAuthPath() {
  return join(projectRoot(process.cwd()), "data", "github-auth.json");
}

export function createGithubState() {
  return `${Date.now()}.${randomBytes(24).toString("hex")}`;
}

export function validGithubState(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const [timestamp] = expected.split(".");
  if (!timestamp || Date.now() - Number(timestamp) > stateTtlMs) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function githubRedirectUri(request: Request) {
  if (process.env.GITHUB_OAUTH_REDIRECT_URI) {
    return process.env.GITHUB_OAUTH_REDIRECT_URI;
  }
  const url = new URL(request.url);
  const publicUrl = process.env.AG_PUBLIC_WEB_URL || `${url.protocol}//${url.host}`;
  return `${publicUrl.replace(/\/$/, "")}/api/github/callback`;
}

export function githubAuthorizeUrl(input: { state: string; redirectUri: string }) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId() ?? "");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", process.env.GITHUB_OAUTH_SCOPES ?? "repo read:user user:email read:org");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function readStoredGitHubAuth(): StoredGitHubAuth | null {
  const path = githubAuthPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StoredGitHubAuth;
  } catch {
    return null;
  }
}

export function writeStoredGitHubAuth(auth: StoredGitHubAuth) {
  const path = githubAuthPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(auth, null, 2));
}

export async function exchangeGithubCode(input: { code: string; redirectUri: string }) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: input.code,
      redirect_uri: input.redirectUri
    })
  });
  const data = await response.json() as { access_token?: string; token_type?: string; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `GitHub token exchange failed with ${response.status}`);
  }
  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? "bearer",
    scope: data.scope ?? ""
  };
}

export async function readGithubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: githubApiHeaders(accessToken),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`GitHub user API returned ${response.status}`);
  }
  return response.json() as Promise<GitHubUser>;
}

export function githubApiHeaders(accessToken: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

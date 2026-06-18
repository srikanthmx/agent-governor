import { createSign } from "node:crypto";

const githubApiVersion = "2022-11-28";

export type GitHubInstallationToken = {
  token: string;
  expiresAt: string;
  permissions: Record<string, string>;
  repositories: Array<{ id: number; name: string; fullName: string; private: boolean }>;
};

export function githubAppConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

export function githubAppMissingConfigMessage() {
  return "GitHub App mode requires GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY. Install the app on the target repo before requesting worker credentials.";
}

export async function findGithubRepoInstallation(input: { owner: string; repo: string }): Promise<number> {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/installation`, {
    headers: githubAppHeaders()
  });
  if (!response.ok) {
    throw new Error(await githubApiError(response, "repo installation lookup"));
  }
  const data = await response.json() as { id?: number };
  if (!data.id) {
    throw new Error(`GitHub App is not installed for ${input.owner}/${input.repo}`);
  }
  return data.id;
}

export async function mintGithubInstallationToken(input: {
  installationId: number;
  repositories?: string[];
  permissions?: Record<string, "read" | "write">;
}): Promise<GitHubInstallationToken> {
  const body: Record<string, unknown> = {};
  if (input.repositories?.length) body.repositories = input.repositories;
  if (input.permissions) body.permissions = input.permissions;

  const response = await fetch(`https://api.github.com/app/installations/${input.installationId}/access_tokens`, {
    method: "POST",
    headers: githubAppHeaders(),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await githubApiError(response, "installation token mint"));
  }
  const data = await response.json() as {
    token: string;
    expires_at: string;
    permissions?: Record<string, string>;
    repositories?: Array<{ id: number; name: string; full_name: string; private: boolean }>;
  };
  if (!data.token || !data.expires_at) {
    throw new Error("GitHub returned an installation token response without token metadata");
  }
  return {
    token: data.token,
    expiresAt: data.expires_at,
    permissions: data.permissions ?? {},
    repositories: (data.repositories ?? []).map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private
    }))
  };
}

function githubAppHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${createGithubAppJwt()}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": githubApiVersion
  };
}

function createGithubAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = githubPrivateKey();
  if (!appId || !privateKey) {
    throw new Error(githubAppMissingConfigMessage());
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64urlJson({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId
  });
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(privateKey);
  return `${unsigned}.${signature.toString("base64url")}`;
}

function githubPrivateKey() {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!raw) return null;
  if (raw.includes("BEGIN")) {
    return raw.replace(/\\n/g, "\n");
  }
  return Buffer.from(raw, "base64").toString("utf8").replace(/\\n/g, "\n");
}

function base64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function githubApiError(response: Response, label: string) {
  const text = await response.text().catch(() => "");
  return `GitHub ${label} failed (${response.status} ${response.statusText}): ${text || "no response body"}`;
}

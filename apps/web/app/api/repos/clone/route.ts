import { loadConfig, projectRoot } from "@agent-governor/config";
import { execa } from "execa";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { readStoredGitHubAuth } from "../../github/_oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    nameWithOwner?: string;
    defaultBranch?: string;
  };
  if (!body.nameWithOwner || !body.nameWithOwner.includes("/")) {
    return NextResponse.json({ ok: false, error: "nameWithOwner is required" }, { status: 400 });
  }
  const [owner, repo] = body.nameWithOwner.split("/");
  const stored = readStoredGitHubAuth();
  if (stored) {
    const root = projectRoot(process.cwd());
    const config = loadConfig(root);
    const localPath = join(config.app.paths.repoRoot, repo, "main");
    const branch = body.defaultBranch || "main";
    if (!existsSync(localPath)) {
      const clone = await execa("git", ["clone", "--branch", branch, `https://github.com/${owner}/${repo}.git`, localPath], {
        cwd: root,
        reject: false,
        env: {
          ...process.env,
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
          GIT_CONFIG_VALUE_0: `Authorization: Bearer ${stored.accessToken}`
        }
      });
      if (clone.exitCode !== 0) {
        const output = [clone.stdout, clone.stderr].filter(Boolean).join("\n");
        return NextResponse.json({ ok: false, provider: "github-oauth", error: output || `git clone exited with ${clone.exitCode}` }, { status: 500 });
      }
    }

    const register = await execa("pnpm", [
      "agent",
      "add-repo",
      "--name",
      repo,
      "--owner",
      owner,
      "--repo",
      repo,
      "--path",
      localPath,
      "--branch",
      branch
    ], {
      cwd: root,
      reject: false
    });
    const output = [register.stdout, register.stderr].filter((value): value is string => Boolean(value)).join("\n");
    return NextResponse.json(
      {
        ok: register.exitCode === 0,
        provider: "github-oauth",
        output,
        path: localPath,
        error: register.exitCode === 0 ? undefined : output || `register exited with ${register.exitCode}`
      },
      { status: register.exitCode === 0 ? 200 : 500 }
    );
  }

  const args = [
    "agent",
    "clone-repo",
    "--name",
    repo,
    "--owner",
    owner,
    "--repo",
    repo,
    "--branch",
    body.defaultBranch || "main"
  ];
  const result = await execa("pnpm", args, {
    cwd: projectRoot(process.cwd()),
    reject: false
  });
  const output = [result.stdout, result.stderr].filter((value): value is string => Boolean(value)).join("\n");
  return NextResponse.json(
    {
      ok: result.exitCode === 0,
      output,
      error: result.exitCode === 0 ? undefined : output || `clone exited with ${result.exitCode}`
    },
    { status: result.exitCode === 0 ? 200 : 500 }
  );
}

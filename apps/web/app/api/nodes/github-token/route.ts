import { NextResponse } from "next/server";
import {
  findGithubRepoInstallation,
  githubAppConfigured,
  githubAppMissingConfigMessage,
  mintGithubInstallationToken
} from "../../github/_app-token";
import { closeNodeApiContext, nodeApiContext, requireWorkerNode } from "../_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenRequestBody = {
  owner?: string;
  repo?: string;
  installationId?: number;
};

export async function POST(request: Request) {
  const context = nodeApiContext();
  try {
    const node = requireWorkerNode(request, context.registry);
    const body = await request.json().catch(() => ({})) as TokenRequestBody;
    const owner = body.owner?.trim();
    const repo = body.repo?.trim();
    if (!owner || !repo) {
      return NextResponse.json({ ok: false, error: "owner and repo are required" }, { status: 400 });
    }

    const fullName = `${owner}/${repo}`;
    const allowlist = JSON.parse(node.repo_allowlist_json) as string[];
    if (allowlist.length > 0 && !allowlist.includes(fullName)) {
      context.registry.recordEvent({
        nodeId: node.id,
        eventType: "github_token.denied",
        message: `Denied GitHub token request for ${fullName}`,
        metadata: { owner, repo, reason: "repo_not_allowlisted" }
      });
      return NextResponse.json({ ok: false, error: `${fullName} is not in this worker node's repo allowlist` }, { status: 403 });
    }

    if (!githubAppConfigured()) {
      return NextResponse.json({ ok: false, error: githubAppMissingConfigMessage() }, { status: 400 });
    }

    const installationId = body.installationId ?? await findGithubRepoInstallation({ owner, repo });
    const installationToken = await mintGithubInstallationToken({
      installationId,
      repositories: [repo],
      permissions: {
        contents: "write",
        metadata: "read",
        pull_requests: "write"
      }
    });

    context.registry.recordEvent({
      nodeId: node.id,
      eventType: "github_token.issued",
      message: `Issued short-lived GitHub token for ${fullName}`,
      metadata: {
        owner,
        repo,
        installationId,
        expiresAt: installationToken.expiresAt,
        permissions: installationToken.permissions
      }
    });

    return NextResponse.json({
      ok: true,
      provider: "github-app",
      owner,
      repo,
      installationId,
      expiresAt: installationToken.expiresAt,
      git: {
        remoteUrl: `https://github.com/${fullName}.git`,
        extraHeader: `Authorization: Bearer ${installationToken.token}`
      },
      permissions: installationToken.permissions
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 401 });
  } finally {
    closeNodeApiContext(context);
  }
}

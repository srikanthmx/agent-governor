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
  taskId?: number;
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
    if (body.taskId) {
      const activeClaim = context.db.prepare(
        `SELECT worker_task_claims.id
         FROM worker_task_claims
         JOIN tasks ON tasks.id = worker_task_claims.task_id
         JOIN repos ON repos.id = tasks.repo_id
         WHERE worker_task_claims.node_id = ?
           AND worker_task_claims.task_id = ?
           AND worker_task_claims.status IN ('claimed', 'running')
           AND repos.github_owner = ?
           AND repos.github_repo = ?`
      ).get(node.id, body.taskId, owner, repo);
      if (!activeClaim) {
        context.registry.recordEvent({
          nodeId: node.id,
          taskId: body.taskId,
          eventType: "github_token.denied",
          message: `Denied GitHub token request for ${fullName}`,
          metadata: { owner, repo, reason: "no_active_claim" }
        });
        return NextResponse.json({ ok: false, error: `No active claim for TASK-${body.taskId} on ${fullName}` }, { status: 403 });
      }
    }
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

    if (process.env.AG_DEV_WORKER_GIT_TOKEN_ENABLED === "true") {
      const remoteUrl = process.env.AG_DEV_WORKER_GIT_REMOTE_URL || `https://github.com/${fullName}.git`;
      const extraHeader = process.env.AG_DEV_WORKER_GIT_EXTRA_HEADER;
      context.registry.recordEvent({
        nodeId: node.id,
        taskId: body.taskId ?? null,
        eventType: "github_token.issued",
        message: `Issued dev Git token for ${fullName}`,
        metadata: { owner, repo, provider: "dev", remoteUrl }
      });
      return NextResponse.json({
        ok: true,
        provider: "dev",
        owner,
        repo,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        git: {
          remoteUrl,
          extraHeader
        },
        permissions: {
          contents: "write",
          metadata: "read",
          pull_requests: "write"
        }
      });
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

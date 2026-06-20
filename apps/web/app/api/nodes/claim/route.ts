import { NextResponse } from "next/server";
import { closeNodeApiContext, nodeApiContext, requireWorkerNode } from "../_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = nodeApiContext();
  try {
    const node = requireWorkerNode(request, context.registry);
    context.registry.heartbeat({ nodeId: node.id, status: "online" });
    const claimed = context.registry.claimNextTask(node.id);
    if (!claimed) {
      return NextResponse.json({ ok: true, claimed: false, task: null });
    }
    const repo = context.db
      .prepare("SELECT id, name, github_owner, github_repo, default_branch FROM repos WHERE id = ?")
      .get(claimed.task.repo_id) as { id: number; name: string; github_owner: string; github_repo: string; default_branch: string } | undefined;
    context.registry.recordEvent({
      nodeId: node.id,
      taskId: claimed.task.id,
      eventType: "task.claimed",
      message: `${node.name} claimed TASK-${claimed.task.id}`,
      metadata: { claimId: claimed.claim.id }
    });
    return NextResponse.json({
      ok: true,
      claimed: true,
      claim: {
        id: claimed.claim.id,
        status: claimed.claim.status,
        claimedAt: claimed.claim.claimed_at
      },
      task: {
        id: claimed.task.id,
        title: claimed.task.title,
        description: claimed.task.description,
        status: claimed.task.status,
        workflow: claimed.task.workflow,
        createdBy: claimed.task.created_by,
        repoId: claimed.task.repo_id,
        branchName: claimed.task.branch_name,
        worktreePath: claimed.task.worktree_path,
        repo: repo ? {
          id: repo.id,
          name: repo.name,
          owner: repo.github_owner,
          repo: repo.github_repo,
          defaultBranch: repo.default_branch
        } : null
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 401 });
  } finally {
    closeNodeApiContext(context);
  }
}

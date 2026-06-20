import { NextResponse } from "next/server";
import { closeNodeApiContext, nodeApiContext, requireWorkerNode } from "../../_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updateClaim(request: Request, { params }: { params: { claimId: string } }) {
  const context = nodeApiContext();
  try {
    const node = requireWorkerNode(request, context.registry);
    const claimId = Number(params.claimId);
    if (!Number.isFinite(claimId)) {
      return NextResponse.json({ ok: false, error: "Invalid claim id" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({})) as {
      status?: string;
      result?: Record<string, unknown>;
    };
    if (body.status !== "completed" && body.status !== "failed") {
      return NextResponse.json({ ok: false, error: "status must be completed or failed" }, { status: 400 });
    }
    const claim = context.registry.finishClaim({
      claimId,
      nodeId: node.id,
      status: body.status,
      result: body.result
    });
    if (body.status === "completed") {
      const taskStatus = typeof body.result?.taskStatus === "string" ? body.result.taskStatus : null;
      const currentStage = typeof body.result?.currentStage === "string" ? body.result.currentStage : null;
      const prUrl = typeof body.result?.prUrl === "string" ? body.result.prUrl : null;
      const branchName = typeof body.result?.branchName === "string" ? body.result.branchName : null;
      const worktreePath = typeof body.result?.worktreePath === "string" ? body.result.worktreePath : null;
      if (taskStatus || currentStage || prUrl || branchName || worktreePath) {
        context.db.prepare(
          `UPDATE tasks
           SET status = COALESCE(?, status),
               current_stage = COALESCE(?, current_stage),
               pr_url = COALESCE(?, pr_url),
               branch_name = COALESCE(?, branch_name),
               worktree_path = COALESCE(?, worktree_path),
               updated_at = ?
           WHERE id = ?`
        ).run(taskStatus, currentStage, prUrl, branchName, worktreePath, new Date().toISOString(), claim.task_id);
      }
    }
    context.registry.recordEvent({
      nodeId: node.id,
      taskId: typeof body.result?.taskId === "number" ? body.result.taskId : claim.task_id,
      eventType: `claim.${body.status}`,
      message: `${node.name} marked claim ${claimId} ${body.status}`,
      metadata: body.result ?? {}
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("Missing Authorization") || message.startsWith("Invalid worker node token")
      ? 401
      : message.startsWith("Claim not found")
        ? 404
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  } finally {
    closeNodeApiContext(context);
  }
}

export async function POST(request: Request, context: { params: { claimId: string } }) {
  return updateClaim(request, context);
}

export async function PATCH(request: Request, context: { params: { claimId: string } }) {
  return updateClaim(request, context);
}

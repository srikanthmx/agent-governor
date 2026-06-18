import { NextResponse } from "next/server";
import { closeNodeApiContext, nodeApiContext } from "../_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { nodeId: string } }) {
  const context = nodeApiContext();
  try {
    const node = context.registry.get(params.nodeId);
    if (!node) {
      return NextResponse.json({ ok: false, error: "Worker node not found" }, { status: 404 });
    }
    context.db.prepare("DELETE FROM worker_events WHERE node_id = ?").run(params.nodeId);
    context.db.prepare("DELETE FROM worker_task_claims WHERE node_id = ?").run(params.nodeId);
    context.db.prepare("DELETE FROM worker_nodes WHERE id = ?").run(params.nodeId);
    return NextResponse.json({ ok: true });
  } finally {
    closeNodeApiContext(context);
  }
}

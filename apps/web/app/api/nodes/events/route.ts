import { NextResponse } from "next/server";
import { closeNodeApiContext, nodeApiContext, requireWorkerNode } from "../_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = nodeApiContext();
  try {
    const node = requireWorkerNode(request, context.registry);
    const body = await request.json().catch(() => ({})) as {
      taskId?: number;
      eventType?: string;
      message?: string;
      metadata?: Record<string, unknown>;
    };
    const eventType = body.eventType?.trim();
    const message = body.message?.trim();
    if (!eventType || !message) {
      return NextResponse.json({ ok: false, error: "eventType and message are required" }, { status: 400 });
    }
    context.registry.recordEvent({
      nodeId: node.id,
      taskId: body.taskId ?? null,
      eventType,
      message,
      metadata: body.metadata ?? {}
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 401 });
  } finally {
    closeNodeApiContext(context);
  }
}

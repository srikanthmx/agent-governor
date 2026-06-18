import { NextResponse } from "next/server";
import { closeNodeApiContext, nodeApiContext, parseStringArray, publicNode, requireWorkerNode } from "../_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    status?: string;
    capabilities?: unknown;
    runtimes?: unknown;
    repoAllowlist?: unknown;
  };
  const context = nodeApiContext();
  try {
    const node = requireWorkerNode(request, context.registry);
    const updated = context.registry.heartbeat({
      nodeId: node.id,
      status: body.status ?? "online",
      capabilities: Array.isArray(body.capabilities) ? parseStringArray(body.capabilities) : undefined,
      runtimes: Array.isArray(body.runtimes) ? parseStringArray(body.runtimes) : undefined,
      repoAllowlist: Array.isArray(body.repoAllowlist) ? parseStringArray(body.repoAllowlist) : undefined
    });
    return NextResponse.json({ ok: true, node: publicNode(updated) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 401 });
  } finally {
    closeNodeApiContext(context);
  }
}

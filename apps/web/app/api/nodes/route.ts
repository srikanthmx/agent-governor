import { NextResponse } from "next/server";
import { closeNodeApiContext, hashNodeToken, newNodeId, newNodeToken, nodeApiContext, parseStringArray, publicNode } from "./_node-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = nodeApiContext();
  try {
    return NextResponse.json({
      ok: true,
      nodes: context.registry.list().map(publicNode)
    });
  } finally {
    closeNodeApiContext(context);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    id?: string;
    name?: string;
    ownerId?: string;
    mode?: string;
    capabilities?: unknown;
    runtimes?: unknown;
    repoAllowlist?: unknown;
    endpointUrl?: string;
  };
  const context = nodeApiContext();
  try {
    const token = newNodeToken();
    const node = context.registry.register({
      id: body.id || newNodeId(),
      name: body.name?.trim() || "Desktop worker",
      ownerId: body.ownerId ?? null,
      mode: body.mode ?? "desktop",
      capabilities: parseStringArray(body.capabilities),
      runtimes: parseStringArray(body.runtimes),
      repoAllowlist: parseStringArray(body.repoAllowlist),
      endpointUrl: body.endpointUrl ?? null,
      authTokenHash: hashNodeToken(token)
    });
    context.registry.recordEvent({
      nodeId: node.id,
      eventType: "node.registered",
      message: `${node.name} registered as a desktop worker`,
      metadata: { mode: node.mode }
    });
    return NextResponse.json({
      ok: true,
      node: publicNode(node),
      token
    });
  } finally {
    closeNodeApiContext(context);
  }
}

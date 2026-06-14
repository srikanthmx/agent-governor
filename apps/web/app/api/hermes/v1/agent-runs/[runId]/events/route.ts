import { NextResponse } from "next/server";
import { hermesEvents, sse } from "../../../../_bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { runId: string } }) {
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "true";
  const taskId = params.runId.replace(/^govrun_/, "") || "6";
  const events = hermesEvents(taskId);

  if (stream) {
    return sse(events);
  }

  return NextResponse.json({
    ok: true,
    runId: params.runId,
    events
  });
}

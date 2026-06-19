import { NextResponse } from "next/server";
import { hermesEvents, sse } from "../../../../_bridge";
import { buildTaskProgressSnapshot, encodeSseEvent } from "../../../../../tasks/_timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { runId: string } }) {
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "true";
  const taskId = params.runId.replace(/^govrun_/, "") || "6";
  const numericTaskId = Number(taskId.replace(/^TASK-/i, ""));
  if (Number.isFinite(numericTaskId) && numericTaskId > 0) {
    const snapshot = buildTaskProgressSnapshot(numericTaskId, `${url.protocol}//${url.host}`);
    if (snapshot.ok) {
      if (stream) {
        return new Response(
          [
            encodeSseEvent("snapshot", {
              runId: params.runId,
              task: snapshot.task,
              nextAction: snapshot.nextAction,
              links: snapshot.links
            }),
            ...snapshot.events.map((event) => encodeSseEvent("progress", event)),
            "data: [DONE]\n\n"
          ].join(""),
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive"
            }
          }
        );
      }
      return NextResponse.json({
        ok: true,
        runId: params.runId,
        task: snapshot.task,
        nextAction: snapshot.nextAction,
        links: snapshot.links,
        events: snapshot.events
      });
    }
  }
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

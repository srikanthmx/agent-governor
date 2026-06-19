import { NextResponse } from "next/server";
import { buildTaskProgressSnapshot, encodeSseEvent } from "../../_timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTaskId(value: string): number | null {
  const id = Number(String(value).replace(/^TASK-/i, ""));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(request: Request, { params }: { params: { taskId: string } }) {
  const taskId = parseTaskId(params.taskId);
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const stream = url.searchParams.get("stream") === "true";
  const once = url.searchParams.get("once") === "true";
  if (!stream) {
    const snapshot = buildTaskProgressSnapshot(taskId, origin);
    return NextResponse.json(snapshot, { status: snapshot.ok ? 200 : 404 });
  }
  if (once) {
    const snapshot = buildTaskProgressSnapshot(taskId, origin);
    const body = [
      encodeSseEvent("snapshot", {
        task: snapshot.task,
        nextAction: snapshot.nextAction,
        links: snapshot.links
      }),
      ...snapshot.events.map((event) => encodeSseEvent("progress", event)),
      "data: [DONE]\n\n"
    ].join("");
    return new Response(body, {
      status: snapshot.ok ? 200 : 404,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let sent = new Set<string>();
      let interval: ReturnType<typeof setInterval> | null = null;
      const sendSnapshot = () => {
        if (closed) return;
        try {
          const snapshot = buildTaskProgressSnapshot(taskId, origin);
          controller.enqueue(encoder.encode(encodeSseEvent("snapshot", {
            task: snapshot.task,
            nextAction: snapshot.nextAction,
            links: snapshot.links
          })));
          for (const event of snapshot.events) {
            if (!sent.has(event.id)) {
              sent.add(event.id);
              controller.enqueue(encoder.encode(encodeSseEvent("progress", event)));
            }
          }
          if (["done", "failed"].includes(snapshot.nextAction.type)) {
            controller.enqueue(encoder.encode(encodeSseEvent("done", snapshot)));
            closed = true;
            if (interval) clearInterval(interval);
            controller.close();
          }
        } catch (error) {
          controller.enqueue(encoder.encode(encodeSseEvent("error", {
            error: error instanceof Error ? error.message : String(error)
          })));
        }
      };
      sendSnapshot();
      interval = setInterval(sendSnapshot, 1500);
      setTimeout(() => {
        if (!closed) {
          closed = true;
          if (interval) clearInterval(interval);
          controller.enqueue(encoder.encode(encodeSseEvent("heartbeat", { at: new Date().toISOString() })));
          controller.close();
        }
      }, 120_000);
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

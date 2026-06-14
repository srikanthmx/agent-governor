import { NextResponse } from "next/server";
import { bootstrapHermesSidecar, getHermesSidecarStatus, startHermesSidecar, stopHermesSidecar } from "../_sidecar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    sidecar: await getHermesSidecarStatus()
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action === "bootstrap") {
    return NextResponse.json(await bootstrapHermesSidecar());
  }
  if (body.action === "start") {
    return NextResponse.json(await startHermesSidecar());
  }
  if (body.action === "stop") {
    return NextResponse.json(await stopHermesSidecar());
  }

  return NextResponse.json(
    { ok: false, error: "action must be one of: bootstrap, start, stop" },
    { status: 400 }
  );
}

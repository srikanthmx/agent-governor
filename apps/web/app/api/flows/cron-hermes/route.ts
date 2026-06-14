import { NextResponse } from "next/server";
import { runSampleFlow } from "../_sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CronFlowRequest = {
  prompt?: string;
  cronName?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as CronFlowRequest;
  return NextResponse.json(await runSampleFlow({
    source: "cron",
    prompt: body.prompt,
    cronName: body.cronName
  }));
}

export async function GET() {
  return NextResponse.json(await runSampleFlow({ source: "cron" }));
}

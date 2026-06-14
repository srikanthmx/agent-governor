import { NextResponse } from "next/server";
import { runSampleFlow } from "../_sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramFlowRequest = {
  prompt?: string;
  chatId?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as TelegramFlowRequest;
  return NextResponse.json(await runSampleFlow({
    source: "telegram",
    prompt: body.prompt,
    chatId: body.chatId
  }));
}

export async function GET() {
  return NextResponse.json(await runSampleFlow({ source: "telegram" }));
}

import { NextResponse } from "next/server";
import { createModelCompletion, modelSse, type ChatCompletionRequest } from "../../../_model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as ChatCompletionRequest;
  const completion = await createModelCompletion(body);
  if (body.stream) {
    return modelSse(completion);
  }

  return NextResponse.json(completion);
}

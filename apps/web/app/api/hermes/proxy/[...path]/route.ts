import { NextResponse } from "next/server";
import { proxyHermes } from "../../_sidecar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(request: Request, context: RouteContext) {
  return forwardToHermes(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return forwardToHermes(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return forwardToHermes(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return forwardToHermes(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forwardToHermes(request, context);
}

async function forwardToHermes(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const path = `/${context.params.path.join("/")}${url.search}`;
  const method = request.method;
  const hasBody = !["GET", "HEAD"].includes(method);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const response = await proxyHermes(path, {
      method,
      headers,
      body: hasBody ? await request.text() : undefined
    });
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: filteredHeaders(response.headers)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Hermes sidecar is unreachable."
      },
      { status: 502 }
    );
  }
}

function filteredHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("content-encoding");
  nextHeaders.delete("content-length");
  nextHeaders.delete("transfer-encoding");
  return nextHeaders;
}

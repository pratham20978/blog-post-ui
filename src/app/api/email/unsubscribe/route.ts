import { NextResponse, type NextRequest } from "next/server";

import { API_PREFIX, apiOrigin } from "@/shared/config";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(
    new URL(`/email/unsubscribe?token=${encodeURIComponent(token)}`, request.url),
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse(null, { status: 400 });

  let response: Response;
  try {
    const target = new URL(`${API_PREFIX}/email/preferences/unsubscribe`, apiOrigin());
    target.searchParams.set("token", token);
    response = await fetch(target, { method: "POST", cache: "no-store" });
  } catch {
    return new NextResponse(null, { status: 503 });
  }

  // RFC 8058 asks for an empty 200/202 response. Do not proxy the API envelope
  // or set an actor/session cookie on a mailbox provider's one-click request.
  return new NextResponse(null, { status: response.ok ? 202 : response.status });
}

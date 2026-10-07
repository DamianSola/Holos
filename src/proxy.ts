import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { businessContextCookie } from "@/lib/business-context";

const businessIdPattern = /^\/businesses\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(businessIdPattern);
  if (!match || request.cookies.get(businessContextCookie)?.value === match[1]) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(businessContextCookie, match[1], {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export const config = {
  matcher: "/businesses/:path*",
};

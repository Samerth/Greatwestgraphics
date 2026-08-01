import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const COOKIE = "gwg_staff_session";

function validSession(token: string | undefined): boolean {
  if (!token) return false;
  const secret =
    process.env.STAFF_SESSION_SECRET || "dev-insecure-session-secret";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [username, expRaw, signature] = parts;
  if (!username || !expRaw || !signature) return false;
  const payload = `${username}.${expRaw}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  return Number(expRaw) >= Date.now();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }
  const token = request.cookies.get(COOKIE)?.value;
  if (!validSession(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

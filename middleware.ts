import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/admin/session-crypto";
import {
  PATHNAME_HEADER,
  STORE_COOKIE,
  STORE_SLUG_HEADER,
} from "@/lib/commerce/store-cookie";

const COOKIE = "gwg_staff_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // Login page + credential POST (must stay public; auth sets the session cookie).
    if (pathname === "/admin/login" || pathname === "/admin/auth") {
      return NextResponse.next();
    }

    const token = request.cookies.get(COOKIE)?.value;
    const session = await verifySessionToken(token);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const storeSlug = request.cookies.get(STORE_COOKIE)?.value;
  if (!storeSlug) return NextResponse.next();

  // Hand the selection to server components as a header, and make sure no
  // shared cache keeps the result: these pages differ per store while the URL
  // does not, so a CDN that cached one would serve it to somebody else's team.
  const headers = new Headers(request.headers);
  headers.set(STORE_SLUG_HEADER, storeSlug);
  headers.set(PATHNAME_HEADER, pathname);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)"],
};

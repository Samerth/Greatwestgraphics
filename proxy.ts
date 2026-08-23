import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/admin/session-crypto";
import {
  PATHNAME_HEADER,
  STORE_COOKIE,
  STORE_SLUG_HEADER,
} from "@/lib/commerce/store-cookie";
import { isProtectedAppPath } from "@/lib/seo/protected-paths";
import { resolveLegacyRedirect } from "@/lib/seo/redirects";

const COOKIE = "gwg_staff_session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allowlist only — never 301 a working commerce prefix. Unknown paths
  // fall through and 404 rather than bounce to the homepage.
  if (!isProtectedAppPath(pathname)) {
    const seoRedirect = resolveLegacyRedirect(pathname);
    if (seoRedirect) {
      const url = request.nextUrl.clone();
      url.pathname = seoRedirect;
      return NextResponse.redirect(url, 301);
    }
  }

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
  matcher: [
    // Skip API, Next internals, and static files. Shop/admin prefixes stay
    // in the matcher so store cookies and staff auth still run; SEO
    // redirects never apply to those prefixes (see isProtectedAppPath).
    "/((?!_next/|api/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|woff2?)$).*)",
    // /api/commerce/* also needs the store-slug header: POST
    // /api/commerce/job-requests calls createCommerceClient() with no
    // override, which falls back to resolveStoreContext() → the pinned/
    // host-resolved default store, silently attaching every storefront
    // order to the retail store instead of the one the shopper was on.
    "/api/commerce/:path*",
  ],
};

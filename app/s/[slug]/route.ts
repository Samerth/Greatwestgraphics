import { NextResponse } from "next/server";
import { SHOW_TEAM_STORES } from "@/lib/features";
import {
  isStoreSlug,
  safeInternalNextPath,
  STORE_COOKIE,
  storeCookieOptions,
} from "@/lib/commerce/store-cookie";

/**
 * Entry point for a branded storefront: `/s/acme` selects that store and drops
 * the visitor on the shop with it applied.
 *
 * The selection is a cookie rather than a URL prefix so that every link
 * already in the site keeps working. Prefixing would mean rewriting every
 * href in the app and losing the store the first time somebody followed one
 * that wasn't rewritten.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  // Row 51: the branded storefront entry point is closed while team
  // stores are off. A 404 rather than a redirect, so a link that leaks
  // out reads as 'no such page' instead of silently landing on the main
  // shop and looking like the store was deleted.
  if (!SHOW_TEAM_STORES) {
    return new NextResponse(null, { status: 404 });
  }

  const { slug } = await context.params;
  const normalized = slug.trim().toLowerCase();
  const nextPath = safeInternalNextPath(new URL(request.url).searchParams.get("next"));

  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const response = NextResponse.redirect(
    new URL(nextPath, base || "http://localhost:3000"),
  );

  if (!isStoreSlug(normalized)) {
    response.cookies.delete(STORE_COOKIE);
    return response;
  }

  response.cookies.set(STORE_COOKIE, normalized, storeCookieOptions());
  return response;
}

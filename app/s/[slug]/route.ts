import { NextResponse } from "next/server";
import { STORE_COOKIE, storeCookieOptions } from "@/lib/commerce/store-cookie";

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
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const normalized = slug.trim().toLowerCase();

  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const response = NextResponse.redirect(new URL("/", base || "http://localhost:3000"));

  if (!/^[a-z0-9-]{2,63}$/.test(normalized)) {
    response.cookies.delete(STORE_COOKIE);
    return response;
  }

  response.cookies.set(STORE_COOKIE, normalized, storeCookieOptions());
  return response;
}

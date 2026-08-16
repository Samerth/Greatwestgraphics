import { NextResponse } from "next/server";
import { STORE_COOKIE, storeCookieOptions } from "@/lib/commerce/store-cookie";

/**
 * Drops the branded-store selection and returns to the main shop.
 *
 * Selecting a store sets a cookie that outlives the visit, so without this a
 * visitor who opened somebody's team store once would keep seeing it for a
 * month with no way back.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const response = NextResponse.redirect(
    new URL("/", base || "http://localhost:3000"),
  );
  response.cookies.set(STORE_COOKIE, "", { ...storeCookieOptions(), maxAge: 0 });
  return response;
}

/** Names the branded store a visitor has selected via `/s/<slug>`. */
export const STORE_COOKIE = "gwg-store";

/**
 * Header the middleware copies the cookie into, so server components can read
 * the selection through `headers()` without every one of them reaching for
 * cookies directly.
 */
export const STORE_SLUG_HEADER = "x-gwg-store-slug";

export function storeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

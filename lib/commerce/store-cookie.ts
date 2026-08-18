/** Names the branded store a visitor has selected via `/s/<slug>`. */
export const STORE_COOKIE = "gwg-store";

/**
 * Header the middleware copies the cookie into, so server components can read
 * the selection through `headers()` without every one of them reaching for
 * cookies directly.
 */
export const STORE_SLUG_HEADER = "x-gwg-store-slug";

/**
 * The path being served, which a layout cannot otherwise ask for.
 *
 * The shop layout needs it to tell shopping a store apart from managing the
 * account that owns it: a store awaiting approval must not be shoppable, but
 * its owner still has to reach the page where teammates are invited.
 */
export const PATHNAME_HEADER = "x-gwg-pathname";

/**
 * Paths that belong to a person's account rather than to the shop, and stay
 * reachable no matter what state the selected store is in.
 */
export function isAccountManagementPath(pathname: string): boolean {
  return (
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/start" ||
    pathname.startsWith("/start/")
  );
}

export function storeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

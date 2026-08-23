import { canonicalizePath } from "./paths";

/**
 * Live Next.js routes. `TREE` prefixes include children (`/product/foo`).
 * `EXACT` prefixes are a single page with no app children — WordPress
 * leftover children like `/faq/old-question` are not treated as the FAQ page.
 */
export const PROTECTED_EXACT = [
  "/contact",
  "/faq",
  "/shop",
  "/studio",
] as const;

export const PROTECTED_TREE = [
  "/account",
  "/admin",
  "/api",
  "/auth",
  "/cart",
  "/category",
  "/checkout",
  "/design",
  "/invite",
  "/leave-store",
  "/portal",
  "/product",
  "/products",
  "/quote",
  "/s",
  "/start",
  "/store",
  "/3d-demo",
] as const;

export const PROTECTED_PREFIXES = [
  ...PROTECTED_EXACT,
  ...PROTECTED_TREE,
] as const;

function matchesPrefix(canonical: string, prefix: string): boolean {
  return canonical === prefix || canonical.startsWith(`${prefix}/`);
}

export function isProtectedTreePath(path: string): boolean {
  const canonical = canonicalizePath(path);
  return PROTECTED_TREE.some((prefix) => matchesPrefix(canonical, prefix));
}

export function isProtectedAppPath(path: string): boolean {
  const canonical = canonicalizePath(path);
  if ((PROTECTED_EXACT as readonly string[]).includes(canonical)) return true;
  return isProtectedTreePath(canonical);
}

export function firstSegment(path: string): string {
  return canonicalizePath(path).split("/").filter(Boolean)[0] ?? "";
}

export function isProtectedFirstSegment(path: string): boolean {
  const segment = firstSegment(path);
  if (!segment) return false;
  return isProtectedAppPath(`/${segment}`);
}

export function patternPrefix(source: string): string {
  const cut = source.indexOf("/:");
  return cut === -1 ? source : source.slice(0, cut) || source;
}

/** True when a next.config redirect source would steal a live tree route. */
export function isProtectedRedirectSource(source: string): boolean {
  if (source.includes("/:")) {
    return isProtectedTreePath(patternPrefix(source));
  }
  return isProtectedAppPath(source);
}

/**
 * Login screens should never dead-end. The shop header already sends the
 * logo to `/`; branded-store logins that arrived with `?next=/s/{slug}`
 * go back to that storefront instead of the operator shop.
 */
export function backToSiteHref(next?: string | null): string {
  if (!next) return "/";
  const path = next.trim();
  if (!path.startsWith("/")) return "/";
  const pathname = path.split("?")[0] ?? "";
  const match = pathname.match(/^\/s\/([^/]+)/);
  if (match?.[1]) return `/s/${match[1]}`;
  return "/";
}

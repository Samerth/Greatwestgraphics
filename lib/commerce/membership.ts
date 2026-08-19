import { safeInternalNextPath } from "./store-cookie";

export type StoreMembershipState =
  | "n/a"
  | "signed-out"
  | "not-a-member"
  | "member";

export type StoreMembership = {
  accountId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeStatus: string;
  storeIsPublic?: boolean;
  role: string;
};

export function isTeamMembership(membership: StoreMembership): boolean {
  // The operator's retail shop auto-joins every signed-in customer as a
  // member. An owner or admin on any store — even one later marked public —
  // is running a branded store and must not be sent back to the wizard.
  if (membership.role === "owner" || membership.role === "admin") return true;
  return !membership.storeIsPublic;
}

export function teamMemberships(memberships: StoreMembership[]): StoreMembership[] {
  return memberships.filter(isTeamMembership);
}

/**
 * Where `/start` should send a signed-in person who already owns or belongs
 * to a branded store. Null means they have no team store yet and the wizard
 * is the right next step.
 *
 * Corporate sign-in uses `?next=/start`. Without this, an approved owner who
 * logged in again landed back on the empty create-store form.
 */
export function existingTeamStorePath(
  memberships: StoreMembership[],
): string | null {
  const teams = teamMemberships(memberships);
  if (teams.length === 0) return null;

  const active = teams.find((membership) => membership.storeStatus === "active");
  if (active) return `/s/${active.storeSlug}`;

  if (teams.some((membership) => membership.storeStatus === "pending_review")) {
    return "/start/pending";
  }

  return "/account/team";
}

function isGenericPostLoginPath(path: string): boolean {
  return (
    !path ||
    path === "/" ||
    path === "/account" ||
    path.startsWith("/start")
  );
}

/**
 * After any customer sign-in, put an approved owner in their branded store
 * rather than on the public shop or the create-store wizard.
 *
 * Deep links (checkout, portal, invite, design) are kept, but opened through
 * `/s/{slug}` so the store cookie is set and they stay in their own storefront.
 */
export function destinationAfterSignIn(
  next: string | undefined,
  memberships: StoreMembership[],
): string {
  const safe = next ? safeInternalNextPath(next) : "";
  const teamPath = existingTeamStorePath(memberships);
  const activeTeam = teamMemberships(memberships).find(
    (membership) => membership.storeStatus === "active",
  );

  if (isGenericPostLoginPath(safe)) {
    return teamPath ?? (safe.startsWith("/start") ? "/start" : "/portal/jobs");
  }

  if (activeTeam && !safe.startsWith("/s/")) {
    return `/s/${activeTeam.storeSlug}?next=${encodeURIComponent(safe)}`;
  }

  return safe;
}

/**
 * Which store the customer portal should read jobs from.
 *
 * A team member who clicked "Shop the main site instead" still has a public
 * store cookie. Listing jobs against that cookie hides every corporate order.
 * Prefer the private store they already belong to, honoring the cookie when it
 * already points at one of those stores.
 */
export function pickPortalStore(
  current: { storeId: string; isPublic: boolean },
  memberships: StoreMembership[],
): StoreMembership | null {
  const teams = teamMemberships(memberships);
  if (teams.length === 0) return null;

  const alreadyOnTeam = teams.find((membership) => membership.storeId === current.storeId);
  if (alreadyOnTeam) return alreadyOnTeam;

  return teams.find((membership) => membership.storeStatus === "active") ?? teams[0] ?? null;
}

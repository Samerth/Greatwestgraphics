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
  return !membership.storeIsPublic;
}

export function teamMemberships(memberships: StoreMembership[]): StoreMembership[] {
  return memberships.filter(isTeamMembership);
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

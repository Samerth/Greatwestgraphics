/**
 * How much of an account's order history a signed-in customer may read.
 *
 * A corporate store's owner is accountable for what their team spends, so they
 * need to see every order placed in their store, not only the ones they typed
 * in themselves. An ordinary member sees their own.
 *
 * The dangerous case this has to keep refusing is the operator's own retail
 * storefront. Every retail shopper who signs in is enrolled into one shared
 * account, so "everything in the account" there means everybody's orders --
 * names, addresses and proofs included. Widening is therefore gated on the
 * store being a private team store first and the person's role second, rather
 * than on role alone. A role misassigned on the public account then leaks
 * nothing, because the public branch never consults the role at all.
 */

export type OrderVisibility =
  | { kind: "whole-account" }
  | { kind: "own-only"; personId: string };

export interface OrderVisibilityInput {
  /** False for the operator's shared retail storefront. */
  storeIsPublic: boolean;
  /** The person's role on the account, or null when they hold no membership. */
  membershipRole: string | null;
  personId: string;
}

export function orderVisibilityFor({
  storeIsPublic,
  membershipRole,
  personId,
}: OrderVisibilityInput): OrderVisibility {
  if (storeIsPublic) return { kind: "own-only", personId };
  if (membershipRole === "owner") return { kind: "whole-account" };
  return { kind: "own-only", personId };
}

/**
 * The `customerPersonId` filter the job request service expects: a person id
 * to narrow by, or `undefined` for a caller allowed to read the whole account.
 */
export function personFilterFor(visibility: OrderVisibility): string | undefined {
  return visibility.kind === "own-only" ? visibility.personId : undefined;
}

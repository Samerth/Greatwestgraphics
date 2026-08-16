import type { Actor } from "@gwg/contracts";

/**
 * How far a query must be narrowed before it is safe to run for a given actor.
 *
 * Tenant plus account is not an authorization boundary for retail customers:
 * the public storefront enrols every shopper who signs in into a single shared
 * account, so an account-scoped filter matches everybody. Anything a customer
 * reads or mutates therefore has to carry a person filter as well.
 *
 * The three cases are spelled out rather than collapsed into an optional
 * `string | undefined`, because the dangerous mistake is treating "this is
 * staff, who may see the whole account" and "we could not tell who this is"
 * as the same absent value. That is the shape the job request leak took.
 */
export type CustomerScope =
  | { kind: "staff" }
  | { kind: "customer"; personId: string }
  | { kind: "unidentified" };

export function customerScopeForActor(actor: Actor): CustomerScope {
  if (actor.type !== "customer") return { kind: "staff" };
  return actor.id
    ? { kind: "customer", personId: actor.id }
    : { kind: "unidentified" };
}

/**
 * The person id to filter by, or `undefined` for a staff caller who is meant
 * to see the whole account. Throws for an unidentified customer rather than
 * returning `undefined`, so a caller cannot fall back to account scope by
 * accident — that fallback is exactly what exposed one customer's jobs to
 * another.
 */
export function requireCustomerScope(
  actor: Actor,
  onUnidentified: () => Error,
): string | undefined {
  const scope = customerScopeForActor(actor);
  if (scope.kind === "unidentified") throw onUnidentified();
  return scope.kind === "customer" ? scope.personId : undefined;
}

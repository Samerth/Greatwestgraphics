import { cache } from "react";
import {
  CommerceApiError,
  createCommerceClient,
  type CommerceClient,
} from "./client";
import { getCustomerSession } from "@/lib/auth/session";
import {
  pickPortalStore,
  teamMemberships,
  type StoreMembership,
} from "./membership";
import { resolveStoreContext, type StoreContext } from "./store-context";

export type PortalScope = {
  client: CommerceClient;
  store: StoreContext;
  memberships: StoreMembership[];
  usingTeam: boolean;
};

/**
 * Commerce client bound to the store the customer portal should show.
 *
 * Shop pages keep following the `gwg-store` cookie. The portal does not: a
 * teammate who left the branded storefront still needs to see that account's
 * jobs, quotes, and proofs.
 */
export const resolvePortalScope = cache(async (): Promise<PortalScope> => {
  const current = await resolveStoreContext();
  const client = await createCommerceClient();
  const session = await getCustomerSession();
  if (!session) {
    return { client, store: current, memberships: [], usingTeam: false };
  }

  let memberships: StoreMembership[] = [];
  try {
    memberships = await client.listMyMemberships(session.personId);
  } catch {
    return { client, store: current, memberships: [], usingTeam: false };
  }

  const picked = pickPortalStore(current, memberships);
  if (!picked || picked.storeId === current.storeId) {
    return {
      client,
      store: current,
      memberships,
      usingTeam: Boolean(picked),
    };
  }

  return {
    client: await createCommerceClient({
      tenantId: current.tenantId,
      accountId: picked.accountId,
      storeId: picked.storeId,
    }),
    store: {
      ...current,
      accountId: picked.accountId,
      storeId: picked.storeId,
      slug: picked.storeSlug,
      name: picked.storeName,
      isPublic: false,
    },
    memberships,
    usingTeam: true,
  };
});

export async function createPortalCommerceClient(): Promise<CommerceClient> {
  return (await resolvePortalScope()).client;
}

async function clientForMembership(
  tenantId: string,
  membership: StoreMembership,
): Promise<CommerceClient> {
  return createCommerceClient({
    tenantId,
    accountId: membership.accountId,
    storeId: membership.storeId,
  });
}

function isMissingJob(error: unknown): boolean {
  return (
    error instanceof CommerceApiError &&
    (error.status === 403 || error.status === 404)
  );
}

/**
 * Find a job across the stores this person belongs to.
 *
 * Portal lists prefer one team store, but a bookmarked `/portal/jobs/:id`
 * may belong to another membership (or to the retail shop). Trying each
 * membership keeps that link working without widening visibility beyond
 * accounts they already belong to.
 */
export async function loadPortalJob(jobId: string) {
  const scope = await resolvePortalScope();
  try {
    return {
      job: await scope.client.getJobRequest(jobId),
      client: scope.client,
      store: scope.store,
    };
  } catch (error) {
    if (!isMissingJob(error)) throw error;
  }

  const current = await resolveStoreContext();
  const tried = new Set([scope.store.storeId]);
  const candidates = [
    ...teamMemberships(scope.memberships),
    ...scope.memberships.filter((membership) => membership.storeIsPublic),
  ];

  for (const membership of candidates) {
    if (tried.has(membership.storeId)) continue;
    tried.add(membership.storeId);
    const client = await clientForMembership(current.tenantId, membership);
    try {
      return {
        job: await client.getJobRequest(jobId),
        client,
        store: {
          ...current,
          accountId: membership.accountId,
          storeId: membership.storeId,
          slug: membership.storeSlug,
          name: membership.storeName,
          isPublic: Boolean(membership.storeIsPublic),
        },
      };
    } catch (error) {
      if (!isMissingJob(error)) throw error;
    }
  }

  return null;
}

export async function createPortalClientForJob(
  jobId: string,
): Promise<CommerceClient> {
  const found = await loadPortalJob(jobId);
  if (!found) {
    throw new CommerceApiError("This job could not be found.", "NOT_FOUND", 404);
  }
  return found.client;
}

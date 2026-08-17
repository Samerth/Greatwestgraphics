/**
 * Which account a staff write runs against.
 *
 * Customers are confined to the account their session sits in, and
 * `assertScope` enforces exactly that. Staff are the opposite case: head
 * office holds one account while every branded team store owns its orders
 * under an account of its own, so comparing against the caller's account
 * refused every team store job — staff could not quote, proof, or advance a
 * single order a corporate customer had placed.
 *
 * The account therefore comes from the job row, resolved by the caller, never
 * from the request body. Naming somebody else's account in the payload changes
 * nothing. The tenant is the boundary that is genuinely enforced here.
 */
export interface RequestScope {
  tenantId: string;
  accountId: string;
  storeId: string;
}

export interface JobOwner {
  accountId: string;
  storeId: string;
}

export function staffScopedContext<E extends Error>(
  authTenantId: string,
  context: RequestScope,
  owner: JobOwner,
  refuse: () => E,
): RequestScope {
  if (authTenantId !== context.tenantId) {
    throw refuse();
  }
  return {
    ...context,
    accountId: owner.accountId,
    storeId: owner.storeId,
  };
}

import { createCustomerSession } from "./session";

/**
 * Local-only customer login when Cognito is not configured.
 *
 * Production never takes this path: a missing user pool there is a
 * misconfiguration, not a reason to accept a password from `.env`.
 */
export function isLocalCustomerAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env.COGNITO_USER_POOL_ID?.trim()
  );
}

export async function signInLocalCustomer(
  email: string,
  password: string,
): Promise<{ email: string; name: string } | null> {
  if (!isLocalCustomerAuthEnabled()) return null;

  const expectedEmail = (
    process.env.LOCAL_CUSTOMER_EMAIL || "customer@example.test"
  )
    .trim()
    .toLowerCase();
  const expectedPassword = process.env.LOCAL_CUSTOMER_PASSWORD?.trim();
  const personId = process.env.COMMERCE_DEV_CUSTOMER_PERSON_ID?.trim();
  if (!expectedPassword || !personId) return null;

  if (email.trim().toLowerCase() !== expectedEmail) return null;
  if (password !== expectedPassword) return null;

  const name = "Development Customer";
  await createCustomerSession(personId, expectedEmail, name);
  return { email: expectedEmail, name };
}

import type { AuthenticationResultType } from "@aws-sdk/client-cognito-identity-provider";
import { createCommerceClient } from "@/lib/commerce/client";
import { createCustomerSession } from "./session";

function decodeIdTokenClaims(idToken: string): {
  sub: string;
  email: string;
  name: string;
} {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed ID token");
  const json = Buffer.from(payload, "base64url").toString("utf8");
  const claims = JSON.parse(json) as Record<string, unknown>;
  return {
    sub: String(claims.sub ?? ""),
    email: String(claims.email ?? ""),
    name: String(claims.name ?? claims.email ?? ""),
  };
}

/**
 * Shared final step for every successful Cognito auth path (password,
 * email OTP): resolve/create the matching commerce `people` row and start
 * our own first-party session cookie.
 */
export async function completeSignIn(
  tokens: AuthenticationResultType,
): Promise<{ email: string; name: string }> {
  if (!tokens.IdToken) {
    throw new Error("Cognito did not return an ID token");
  }
  const claims = decodeIdTokenClaims(tokens.IdToken);
  const client = await createCommerceClient();
  const { personId } = await client.linkPerson({
    system: "cognito",
    externalId: claims.sub,
    email: claims.email,
    name: claims.name,
  });
  await createCustomerSession(personId, claims.email, claims.name);
  return { email: claims.email, name: claims.name };
}

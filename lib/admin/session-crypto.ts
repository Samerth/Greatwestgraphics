/**
 * Edge-safe session HMAC helpers (Web Crypto).
 * Usable from the Next.js proxy (Edge) and Node server actions.
 */

const FALLBACK_DEV_SECRET = "dev-insecure-session-secret";

export function sessionSecret(): string {
  const configured = process.env.STAFF_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("STAFF_SESSION_SECRET must be configured in production");
  }
  return FALLBACK_DEV_SECRET;
}

export async function hmacSha256Hex(
  secret: string,
  payload: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function signSessionPayload(payload: string): Promise<string> {
  return hmacSha256Hex(sessionSecret(), payload);
}

/**
 * Reads back a token minted by `createStaffSession`, whose shape is
 * `username.expiry.signature`.
 *
 * The username is taken as everything before the last two segments rather than
 * as the first of three, because a username is allowed to contain dots and the
 * login page suggests an email address. Splitting on every dot and demanding
 * exactly three parts meant that setting STAFF_ADMIN_USER to an email made
 * signing in appear to work — the password check passed and the cookie was set
 * — and then every request afterwards failed to verify and bounced back to the
 * login page. A credential that is accepted and then silently disbelieved is
 * indistinguishable from a wrong password, so this failed as an unexplainable
 * login loop rather than as an error anyone could act on.
 *
 * Tokens from dot-free usernames parse identically, so existing sessions are
 * unaffected.
 */
export async function verifySessionToken(
  token: string | undefined
): Promise<{ username: string } | null> {
  if (!token) return null;

  const signatureAt = token.lastIndexOf(".");
  if (signatureAt <= 0) return null;
  const signature = token.slice(signatureAt + 1);
  const payload = token.slice(0, signatureAt);

  const expiryAt = payload.lastIndexOf(".");
  if (expiryAt <= 0) return null;
  const expRaw = payload.slice(expiryAt + 1);
  const username = payload.slice(0, expiryAt);
  if (!username || !expRaw || !signature) return null;

  let expected: string;
  try {
    expected = await signSessionPayload(payload);
  } catch {
    return null;
  }

  if (!timingSafeEqualHex(signature, expected)) return null;
  // An unparseable expiry must not read as "not yet expired": NaN compares
  // false against everything, so the original check would have let it through.
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return { username };
}

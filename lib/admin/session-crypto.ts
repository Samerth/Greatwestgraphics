/**
 * Edge-safe session HMAC helpers (Web Crypto).
 * Usable from Next.js middleware (Edge) and Node server actions.
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

export async function verifySessionToken(
  token: string | undefined
): Promise<{ username: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expRaw, signature] = parts;
  if (!username || !expRaw || !signature) return null;

  const payload = `${username}.${expRaw}`;
  let expected: string;
  try {
    expected = await signSessionPayload(payload);
  } catch {
    return null;
  }

  if (!timingSafeEqualHex(signature, expected)) return null;
  if (Number(expRaw) < Date.now()) return null;
  return { username };
}

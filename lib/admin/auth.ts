import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gwg_staff_session";

function secret() {
  const value = process.env.STAFF_SESSION_SECRET;
  if (!value) {
    // No insecure fallback: that string would sit in source control, so any
    // deploy that forgets to set this would let anyone forge a valid staff
    // admin session cookie from the public repo alone.
    throw new Error("STAFF_SESSION_SECRET is required");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function staffCredentials() {
  return {
    user: process.env.STAFF_ADMIN_USER || "admin",
    password: process.env.STAFF_ADMIN_PASSWORD || "",
  };
}

export async function createStaffSession(username: string) {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `${username}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearStaffSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getStaffSession(): Promise<{ username: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expRaw, signature] = parts;
  if (!username || !expRaw || !signature) return null;
  const payload = `${username}.${expRaw}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (Number(expRaw) < Date.now()) return null;
  return { username };
}

export function adminToken() {
  const token = process.env.DEV_ADMIN_TOKEN;
  if (!token) throw new Error("DEV_ADMIN_TOKEN is not configured");
  return token;
}

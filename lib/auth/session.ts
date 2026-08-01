import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gwg_customer_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type CustomerSession = {
  personId: string;
  email: string;
  name: string;
  exp: number;
};

function secret() {
  return process.env.CUSTOMER_SESSION_SECRET || "dev-insecure-session-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function encode(session: Omit<CustomerSession, "exp"> & { exp: number }): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): CustomerSession | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(sign(body));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const session = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as CustomerSession;
    if (typeof session.exp !== "number" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function createCustomerSession(
  personId: string,
  email: string,
  name: string,
): Promise<void> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = encode({ personId, email, name, exp });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return decode(token);
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

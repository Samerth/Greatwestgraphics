import { cookies } from "next/headers";
import { signSessionPayload, verifySessionToken } from "@/lib/admin/session-crypto";

const COOKIE = "gwg_staff_session";

export function staffCredentials() {
  return {
    user: process.env.STAFF_ADMIN_USER || "admin",
    password: process.env.STAFF_ADMIN_PASSWORD || "",
  };
}

export async function createStaffSession(username: string) {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `${username}.${exp}`;
  const token = `${payload}.${await signSessionPayload(payload)}`;
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
  return verifySessionToken(jar.get(COOKIE)?.value);
}

export function adminToken() {
  const token = process.env.DEV_ADMIN_TOKEN;
  if (!token) throw new Error("DEV_ADMIN_TOKEN is not configured");
  return token;
}

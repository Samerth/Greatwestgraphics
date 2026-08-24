import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gwg_guest_id";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — matches customer session lifetime

/**
 * Stable anonymous identity for a guest who hasn't signed in yet. Used to
 * key uploaded artwork so a guest's Design Studio session survives a page
 * refresh without forcing sign-in first. Read-only lookup — does NOT
 * create a cookie. Use getOrCreateGuestId() when you need one to exist.
 */
export async function getGuestId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

/**
 * Returns the guest id, creating and persisting one if this is a first
 * visit. Safe to call from a Route Handler (has cookie write access).
 */
export async function getOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}
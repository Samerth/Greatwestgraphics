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

/**
 * Guard for staff-only server actions.
 *
 * `proxy.ts` gates `/admin/*`, and a server action posts to the URL of the
 * page that invoked it, so admin pages are covered today. That stops being true
 * as soon as an action is reached from a page outside `/admin` — which is not
 * hypothetical here, since the pricing actions live under `app/portal`. Keeping
 * the check with the action rather than with its caller's URL means moving a
 * component cannot quietly unprotect a mutation.
 */
export async function requireStaff(): Promise<{ username: string }> {
  const session = await getStaffSession();
  if (!session) {
    throw new Error("Staff sign-in is required for this action");
  }
  return session;
}

export function adminToken() {
  // DEV_ADMIN_TOKEN is a local convenience and is only honoured outside
  // production. Falling back to it everywhere meant a development credential
  // could quietly become the production one the moment ADMIN_API_TOKEN was
  // missing, and the failure would be invisible: the admin pages would work.
  // Refusing is louder and safer than reaching for the weaker secret.
  const token =
    process.env.ADMIN_API_TOKEN ||
    (process.env.NODE_ENV === "production" ? undefined : process.env.DEV_ADMIN_TOKEN);
  if (!token) {
    throw new Error(
      "ADMIN_API_TOKEN is not configured; the admin API cannot be reached",
    );
  }
  return token;
}

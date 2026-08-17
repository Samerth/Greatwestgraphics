import { redirect } from "next/navigation";
import { createStaffSession, staffCredentials } from "@/lib/admin/auth";
import {
  clientKeyFromHeaders,
  createThrottleStore,
  loginAttemptAllowed,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/admin/login-throttle";
import { secretsMatch } from "@/lib/admin/secrets-match";

// node:crypto and the long-lived attempt store below both need the Node
// runtime rather than the edge one.
export const runtime = "nodejs";

/** Per-process and therefore best effort — it is not shared across ECS tasks
 *  and resets on deploy. See the limitation note in `lib/admin/login-throttle.ts`. */
const attempts = createThrottleStore();

function safeNextPath(raw: FormDataEntryValue | null): string {
  const next = String(raw || "/admin");
  return next.startsWith("/admin") ? next : "/admin";
}

function backToLogin(error: string, next: string): never {
  redirect(`/admin/login?error=${error}&next=${encodeURIComponent(next)}`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const next = safeNextPath(formData.get("next"));
  const clientKey = clientKeyFromHeaders(request.headers);
  const now = Date.now();

  // Checked before the credentials are looked at, so a throttled response can
  // never be read as a verdict on the guess that triggered it.
  if (!loginAttemptAllowed(attempts, clientKey, now).allowed) {
    backToLogin("rate_limited", next);
  }

  const expected = staffCredentials();
  // Both comparisons are evaluated before either is acted on: short-circuiting
  // on the username would make it an oracle for the staff account name.
  const usernameMatches = secretsMatch(username, expected.user);
  const passwordMatches = secretsMatch(password, expected.password);

  // An unconfigured STAFF_ADMIN_PASSWORD has to fail closed. Without this the
  // empty string would compare equal to itself and open the admin to anyone.
  if (!expected.password || !usernameMatches || !passwordMatches) {
    recordFailedLogin(attempts, clientKey, now);
    backToLogin("1", next);
  }

  recordSuccessfulLogin(attempts, clientKey, now);
  await createStaffSession(username);
  redirect(next);
}

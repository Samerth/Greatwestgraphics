/**
 * Brute-force throttle for the staff login.
 *
 * Pure on purpose: the caller owns the store and passes the clock, so every
 * rule below can be driven deterministically from a unit test, the same way
 * `services/commerce-api/src/domain/proof-decision.ts` is.
 *
 * Known limitation: the store the caller passes is per-process. The ECS
 * service can run several tasks behind the ALB, so an attacker spreading
 * guesses across tasks effectively multiplies the limits by the task count,
 * and a deploy resets everything. The durable version is a shared store
 * (Redis/DynamoDB) or, better, a WAF rate-based rule on the CloudFront
 * distribution so the flood never reaches the application. This is still worth
 * having in the meantime: it turns an unbounded online guessing attack against
 * a single shared password into a slow one.
 */

/**
 * A staff member mistyping the shared password a couple of times must not be
 * locked out, so the per-IP allowance is deliberately loose.
 */
export const MAX_FAILURES_PER_IP = 5;

/**
 * The backstop that rotating client IPs cannot dodge.
 *
 * There is exactly one staff account, so "failed attempts against the login,
 * from anywhere" is the number that actually bounds a brute force; the per-IP
 * limit only inconveniences the single-host script. The cost is a real denial
 * of service — anyone can burn this many guesses and lock staff out for the
 * lockout window. With one shared password guarding pricing and customer
 * orders that trade is worth making, and the window is short enough to wait
 * out. Revisit if per-user staff accounts ever land.
 */
export const MAX_FAILURES_GLOBAL = 25;

/** Failures older than this stop counting against a key. */
export const ATTEMPT_WINDOW_MS = 15 * 60_000;

/**
 * How long a key is refused once it trips its limit. Held equal to the attempt
 * window so a tripped entry never outlives its own lockout, which is what lets
 * expiry be a single comparison.
 */
export const LOCKOUT_MS = 15 * 60_000;

/** Only walk the map to prune once it is big enough to be worth the scan. */
const PRUNE_ABOVE_ENTRIES = 512;

/** The key the global backstop counts under. Prefixing real client keys with
 *  `ip:` keeps a caller from ever colliding with it. */
export const GLOBAL_KEY = "__global__";

export const UNKNOWN_CLIENT_KEY = "ip:unknown";

export interface ThrottleEntry {
  failures: number;
  windowStartedAt: number;
  /** Epoch ms the key is refused until; 0 when it has not tripped. */
  lockedUntil: number;
}

export type ThrottleStore = Map<string, ThrottleEntry>;

export interface ThrottleVerdict {
  allowed: boolean;
  /** Milliseconds until the caller may try again; 0 when allowed. */
  retryAfterMs: number;
}

export function createThrottleStore(): ThrottleStore {
  return new Map();
}

function limitFor(key: string): number {
  return key === GLOBAL_KEY ? MAX_FAILURES_GLOBAL : MAX_FAILURES_PER_IP;
}

function expiresAt(entry: ThrottleEntry): number {
  return Math.max(entry.lockedUntil, entry.windowStartedAt + ATTEMPT_WINDOW_MS);
}

/** The entry for `key`, or undefined once it has aged out — an expired entry
 *  is indistinguishable from no entry at all. */
function liveEntry(
  store: ThrottleStore,
  key: string,
  now: number,
): ThrottleEntry | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  return now < expiresAt(entry) ? entry : undefined;
}

/** Drops aged-out entries so a spray of one-shot attempts from unique
 *  addresses cannot grow the map without bound. */
export function pruneExpired(store: ThrottleStore, now: number): void {
  for (const [key, entry] of store) {
    if (now >= expiresAt(entry)) store.delete(key);
  }
}

export function loginAttemptAllowed(
  store: ThrottleStore,
  clientKey: string,
  now: number,
): ThrottleVerdict {
  let retryAfterMs = 0;
  for (const key of [clientKey, GLOBAL_KEY]) {
    const entry = liveEntry(store, key, now);
    if (entry && now < entry.lockedUntil) {
      retryAfterMs = Math.max(retryAfterMs, entry.lockedUntil - now);
    }
  }
  return { allowed: retryAfterMs === 0, retryAfterMs };
}

export function recordFailedLogin(
  store: ThrottleStore,
  clientKey: string,
  now: number,
): void {
  if (store.size > PRUNE_ABOVE_ENTRIES) pruneExpired(store, now);

  for (const key of [clientKey, GLOBAL_KEY]) {
    const entry = liveEntry(store, key, now) ?? {
      failures: 0,
      windowStartedAt: now,
      lockedUntil: 0,
    };
    entry.failures += 1;
    if (entry.failures >= limitFor(key)) {
      entry.lockedUntil = now + LOCKOUT_MS;
    }
    store.set(key, entry);
  }
}

export function recordSuccessfulLogin(
  store: ThrottleStore,
  clientKey: string,
  now: number,
): void {
  store.delete(clientKey);
  // The global backstop is left standing: one person finally typing the
  // password correctly says nothing about a flood arriving from elsewhere. It
  // ages out on its own inside ATTEMPT_WINDOW_MS.
  if (store.size > PRUNE_ABOVE_ENTRIES) pruneExpired(store, now);
}

/**
 * The throttle key for the request's apparent viewer address.
 *
 * The hop chain here is viewer -> CloudFront -> ALB. CloudFront appends the
 * viewer's socket address to whatever `x-forwarded-for` already arrived, then
 * the ALB appends CloudFront's edge address. So the last entry is the edge, the
 * second to last is the viewer, and anything further left was supplied by the
 * caller and is worthless. With no CloudFront in front (local, or the ALB hit
 * directly) the chain is one shorter and the only entry is the viewer, which is
 * why a single-entry header is taken at face value.
 *
 * Be honest about what this buys: an attacker with a pool of addresses, or one
 * who can reach the ALB directly and forge the whole header, rotates this key
 * freely and walks past MAX_FAILURES_PER_IP. MAX_FAILURES_GLOBAL is the control
 * that actually holds; this one exists to stop the cheap single-host script and
 * to keep one noisy client from tripping the global limit for everyone.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const viewer = hops.length >= 2 ? hops[hops.length - 2] : hops[0];
    if (viewer) return `ip:${viewer}`;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp ? `ip:${realIp}` : UNKNOWN_CLIENT_KEY;
}

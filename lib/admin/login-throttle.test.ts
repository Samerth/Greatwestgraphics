import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  clientKeyFromHeaders,
  createThrottleStore,
  GLOBAL_KEY,
  loginAttemptAllowed,
  LOCKOUT_MS,
  MAX_FAILURES_GLOBAL,
  MAX_FAILURES_PER_IP,
  pruneExpired,
  recordFailedLogin,
  recordSuccessfulLogin,
  UNKNOWN_CLIENT_KEY,
} from "./login-throttle";

const T0 = 1_700_000_000_000;
const IP = "ip:203.0.113.7";

/** Fails `count` times against `key`, all at the same instant so the lockout
 *  that trips is always `at + LOCKOUT_MS`. */
function failTimes(
  store: ReturnType<typeof createThrottleStore>,
  key: string,
  count: number,
  at = T0,
) {
  for (let i = 0; i < count; i += 1) recordFailedLogin(store, key, at);
}

/** Exhausts the global backstop from addresses that each stay well under the
 *  per-IP limit. */
function floodFromRotatingIps(
  store: ReturnType<typeof createThrottleStore>,
  at = T0,
) {
  for (let i = 0; i < MAX_FAILURES_GLOBAL; i += 1) {
    recordFailedLogin(store, `ip:198.51.100.${i}`, at);
  }
}

describe("per-IP throttling", () => {
  it("allows attempts while under the limit", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP - 1);
    expect(loginAttemptAllowed(store, IP, T0).allowed).toBe(true);
  });

  it("blocks once the limit is reached and stays blocked past it", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP);
    expect(loginAttemptAllowed(store, IP, T0).allowed).toBe(false);

    failTimes(store, IP, 3, T0 + 100);
    expect(loginAttemptAllowed(store, IP, T0 + 200).allowed).toBe(false);
  });

  it("reports how long the caller has to wait", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP);
    expect(loginAttemptAllowed(store, IP, T0).retryAfterMs).toBe(LOCKOUT_MS);
  });

  it("does not punish another address for the first one's failures", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP);
    expect(loginAttemptAllowed(store, "ip:198.51.100.9", T0).allowed).toBe(true);
  });

  it("lets the address back in once the lockout window expires", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP);
    expect(loginAttemptAllowed(store, IP, T0 + LOCKOUT_MS - 1).allowed).toBe(
      false,
    );
    expect(loginAttemptAllowed(store, IP, T0 + LOCKOUT_MS + 1).allowed).toBe(
      true,
    );
  });

  it("forgets failures that fall out of the attempt window", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP - 1);
    // The stale run must not combine with a fresh one to trip the limit.
    failTimes(store, IP, MAX_FAILURES_PER_IP - 1, T0 + ATTEMPT_WINDOW_MS + 1);
    expect(
      loginAttemptAllowed(store, IP, T0 + ATTEMPT_WINDOW_MS + 10).allowed,
    ).toBe(true);
  });

  it("resets the counter after a successful login", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP - 1);
    recordSuccessfulLogin(store, IP, T0 + 10);

    failTimes(store, IP, MAX_FAILURES_PER_IP - 1, T0 + 20);
    expect(loginAttemptAllowed(store, IP, T0 + 30).allowed).toBe(true);
  });
});

describe("global backstop", () => {
  it("trips on rotating addresses that each stay under the per-IP limit", () => {
    const store = createThrottleStore();
    floodFromRotatingIps(store);

    // A previously untouched address is refused, which is the whole point:
    // the attacker cannot buy their way out with more IPs.
    expect(loginAttemptAllowed(store, "ip:203.0.113.250", T0 + 100).allowed).toBe(
      false,
    );
  });

  it("is not cleared by one address logging in successfully", () => {
    const store = createThrottleStore();
    floodFromRotatingIps(store);
    recordSuccessfulLogin(store, IP, T0 + 100);
    expect(loginAttemptAllowed(store, IP, T0 + 101).allowed).toBe(false);
  });

  it("ages out with its window", () => {
    const store = createThrottleStore();
    floodFromRotatingIps(store);
    expect(loginAttemptAllowed(store, IP, T0 + LOCKOUT_MS + 1).allowed).toBe(
      true,
    );
  });
});

describe("pruneExpired", () => {
  it("drops aged-out entries and keeps live ones", () => {
    const store = createThrottleStore();
    recordFailedLogin(store, "ip:old", T0);
    const fresh = T0 + ATTEMPT_WINDOW_MS + 1;
    recordFailedLogin(store, "ip:new", fresh);

    pruneExpired(store, fresh);

    expect(store.has("ip:old")).toBe(false);
    expect(store.has("ip:new")).toBe(true);
    expect(store.has(GLOBAL_KEY)).toBe(true);
  });

  it("leaves a locked-out entry in place until its lockout ends", () => {
    const store = createThrottleStore();
    failTimes(store, IP, MAX_FAILURES_PER_IP);

    pruneExpired(store, T0 + LOCKOUT_MS - 1);
    expect(loginAttemptAllowed(store, IP, T0 + LOCKOUT_MS - 1).allowed).toBe(
      false,
    );

    pruneExpired(store, T0 + LOCKOUT_MS + 1);
    expect(store.size).toBe(0);
  });
});

describe("clientKeyFromHeaders", () => {
  const key = (headers: Record<string, string>) =>
    clientKeyFromHeaders(new Headers(headers));

  it("takes the viewer address CloudFront appended, not the ALB's edge hop", () => {
    expect(key({ "x-forwarded-for": "203.0.113.7, 70.132.1.1" })).toBe(
      "ip:203.0.113.7",
    );
  });

  it("ignores a forged prefix the caller supplied", () => {
    expect(
      key({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7, 70.132.1.1" }),
    ).toBe("ip:203.0.113.7");
  });

  it("uses the only hop when nothing sits in front of the load balancer", () => {
    expect(key({ "x-forwarded-for": "203.0.113.7" })).toBe("ip:203.0.113.7");
  });

  it("tolerates whitespace and empty hops", () => {
    expect(key({ "x-forwarded-for": " 203.0.113.7 ,, 70.132.1.1 " })).toBe(
      "ip:203.0.113.7",
    );
  });

  it("falls back to x-real-ip, then to a shared unknown bucket", () => {
    expect(key({ "x-real-ip": "203.0.113.7" })).toBe("ip:203.0.113.7");
    expect(key({})).toBe(UNKNOWN_CLIENT_KEY);
  });

  it("never collides with the global key", () => {
    expect(key({ "x-forwarded-for": GLOBAL_KEY })).not.toBe(GLOBAL_KEY);
  });
});

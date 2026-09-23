import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/**
 * `proxy.ts` gates `/admin/*` at the route level, but a server action is
 * its own request handler once it's wired to a form — reachable directly if
 * anything ever calls it from outside that gate, or if the gate itself has
 * a gap. `requireStaff()` (lib/admin/auth.ts) is the second, independent
 * check that closes that gap, but it only works where someone remembered
 * to call it: only 2 of 21 mutating actions in app/admin/actions.ts did
 * (client feedback: staff-session checks missing on 19 of them).
 *
 * This test reads the action file's own source and checks every exported
 * action function calls `requireStaff()` somewhere in its body — so the
 * next action added to this file fails a test immediately if the call is
 * left out, instead of shipping a silent gap the way the first 19 did.
 */
describe("every admin action checks the staff session", () => {
  const source = read("app/admin/actions.ts");

  // Every exported action, in file order, paired with the source of its own
  // body (up to whichever comes first: the next export, or end of file).
  const matches = [...source.matchAll(/^export async function (\w+)\(/gm)];
  const actionNames = matches.map((m) => m[1]!);
  const actionBodies = matches.map((m, i) => {
    const start = m.index!;
    const end = matches[i + 1]?.index ?? source.length;
    return source.slice(start, end);
  });

  it("found the full, known set of action functions — this list itself is the regression guard", () => {
    // A function silently renamed out of the `...Action` convention, or a
    // new file created instead of adding here, would both slip past the
    // per-function check below by never being found in the first place.
    // Pinning the count (not just "> 0") is what catches that. 23, as of
    // the two job-note/rush-confirmation actions added for the admin job
    // page rebuild.
    expect(actionNames.length).toBe(23);
    expect(actionNames).toContain("issueInvoiceAction");
    expect(actionNames).toContain("setStorePricingAdjustmentAction");
  });

  it.each(actionNames)("%s calls requireStaff()", (name) => {
    const body = actionBodies[actionNames.indexOf(name)]!;
    expect(body).toMatch(/await requireStaff\(\);/);
  });
});

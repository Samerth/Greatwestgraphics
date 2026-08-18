import { describe, expect, it } from "vitest";
import {
  orderVisibilityFor,
  personFilterFor,
} from "../src/domain/order-visibility.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";

describe("order visibility", () => {
  it("lets a team store's owner read the whole account", () => {
    const visibility = orderVisibilityFor({
      storeIsPublic: false,
      membershipRole: "owner",
      personId: OWNER,
    });

    expect(visibility).toEqual({ kind: "whole-account" });
    expect(personFilterFor(visibility)).toBeUndefined();
  });

  it("keeps an ordinary team member to their own orders", () => {
    const visibility = orderVisibilityFor({
      storeIsPublic: false,
      membershipRole: "member",
      personId: MEMBER,
    });

    expect(visibility).toEqual({ kind: "own-only", personId: MEMBER });
    expect(personFilterFor(visibility)).toBe(MEMBER);
  });

  it("keeps someone with no membership to their own orders", () => {
    const visibility = orderVisibilityFor({
      storeIsPublic: false,
      membershipRole: null,
      personId: MEMBER,
    });

    expect(personFilterFor(visibility)).toBe(MEMBER);
  });

  // The retail storefront enrols every shopper into one shared account, so
  // widening there would hand one shopper the rest of the shop's orders. An
  // owner role on that account must not be enough to open it.
  it("never widens on the public storefront, even for an owner", () => {
    const visibility = orderVisibilityFor({
      storeIsPublic: true,
      membershipRole: "owner",
      personId: OWNER,
    });

    expect(visibility).toEqual({ kind: "own-only", personId: OWNER });
    expect(personFilterFor(visibility)).toBe(OWNER);
  });

  it("does not treat an unrecognised role as ownership", () => {
    for (const role of ["Owner", "OWNER", "admin", "staff", ""]) {
      const visibility = orderVisibilityFor({
        storeIsPublic: false,
        membershipRole: role,
        personId: MEMBER,
      });
      expect(personFilterFor(visibility)).toBe(MEMBER);
    }
  });
});

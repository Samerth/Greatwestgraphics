import { describe, expect, it } from "vitest";
import {
  isAccountManagementPath,
  isPendingStoreAllowedPath,
  isStoreSlug,
  safeInternalNextPath,
} from "./store-cookie";

describe("isAccountManagementPath", () => {
  // These stay reachable while a store waits for approval. Inviting teammates
  // is the only thing an owner can usefully do in that window, and it lived
  // behind the same gate that hid the unapproved shop.
  it("covers the pages that belong to a person's account", () => {
    for (const path of [
      "/account",
      "/account/team",
      "/start",
      "/start/pending",
      "/invite/EjxUtqXsyu_SjsDQGbwp385C0Mrk4Cp7",
    ]) {
      expect(isAccountManagementPath(path)).toBe(true);
    }
  });

  // Invitations are sent in the hours after a store is created, while it is
  // still awaiting approval, so this is the path most likely to be hit during
  // exactly the window the gate covers.
  it("lets an invitee accept while the store still awaits approval", () => {
    expect(isAccountManagementPath("/invite/some-token")).toBe(true);
  });

  it("leaves the shop itself gated", () => {
    for (const path of [
      "/",
      "/products",
      "/product/some-tee",
      "/cart",
      "/checkout",
      "/design",
      "/quote",
    ]) {
      expect(isAccountManagementPath(path)).toBe(false);
    }
  });

  // "/accounts-payable" is not "/account", and a prefix test that let it
  // through would quietly unlock a page the gate is meant to cover.
  it("does not match a path that merely starts with the same letters", () => {
    expect(isAccountManagementPath("/accounts-payable")).toBe(false);
    expect(isAccountManagementPath("/started")).toBe(false);
    expect(isAccountManagementPath("/invitations")).toBe(false);
  });

  it("treats an unknown path as part of the shop", () => {
    expect(isAccountManagementPath("")).toBe(false);
  });
});

describe("isPendingStoreAllowedPath", () => {
  it("lets a team prepare artwork before the store is approved", () => {
    expect(isPendingStoreAllowedPath("/design")).toBe(true);
    expect(isPendingStoreAllowedPath("/account/team")).toBe(true);
  });

  it("keeps shopping and checkout gated", () => {
    expect(isPendingStoreAllowedPath("/products")).toBe(false);
    expect(isPendingStoreAllowedPath("/checkout")).toBe(false);
  });
});

describe("safeInternalNextPath", () => {
  it("keeps a same-origin portal path", () => {
    expect(safeInternalNextPath("/portal/jobs")).toBe("/portal/jobs");
  });

  it("rejects an open redirect", () => {
    expect(safeInternalNextPath("https://evil.example")).toBe("/");
    expect(safeInternalNextPath("//evil.example")).toBe("/");
    expect(safeInternalNextPath("/\\evil.example")).toBe("/");
    expect(safeInternalNextPath("portal/jobs")).toBe("/");
  });
});

describe("isStoreSlug", () => {
  it("accepts the slugs /s/<slug> already sets", () => {
    expect(isStoreSlug("acme")).toBe(true);
    expect(isStoreSlug("a")).toBe(false);
    expect(isStoreSlug("Acme")).toBe(false);
  });
});

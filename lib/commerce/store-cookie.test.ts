import { describe, expect, it } from "vitest";
import { isAccountManagementPath } from "./store-cookie";

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
    ]) {
      expect(isAccountManagementPath(path)).toBe(true);
    }
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
  });

  it("treats an unknown path as part of the shop", () => {
    expect(isAccountManagementPath("")).toBe(false);
  });
});

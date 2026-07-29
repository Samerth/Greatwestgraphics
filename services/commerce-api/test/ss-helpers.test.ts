import { describe, expect, it } from "vitest";
import {
  dollarsToMinor,
  isDarkHex,
  retailFromCost,
  slugify,
} from "../src/adapters/ss-activewear/client.js";

describe("S&S pricing helpers", () => {
  it("converts dollars to minor units", () => {
    expect(dollarsToMinor(7.4)).toBe(740);
    expect(dollarsToMinor(undefined)).toBe(0);
  });

  it("floors retail at mapPrice", () => {
    expect(retailFromCost(800, 2000, 2)).toBe(2000);
    expect(retailFromCost(800, 1000, 2)).toBe(1600);
    expect(retailFromCost(800, null, 2)).toBe(1600);
  });

  it("detects dark hex colours", () => {
    expect(isDarkHex("#111111")).toBe(true);
    expect(isDarkHex("#FFFFFF")).toBe(false);
  });

  it("slugifies product keys", () => {
    expect(slugify("Gildan", "2000", "Black")).toBe("gildan-2000-black");
  });
});

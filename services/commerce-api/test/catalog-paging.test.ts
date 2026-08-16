import { describe, expect, it } from "vitest";
import {
  MAX_CATALOG_PAGE_SIZE,
  parseOffset,
  parsePageSize,
} from "../src/app.js";

describe("parsePageSize", () => {
  it("uses the caller's size when it is reasonable", () => {
    expect(parsePageSize("120", 50)).toBe(120);
  });

  it("falls back when the parameter is absent or empty", () => {
    expect(parsePageSize(undefined, 50)).toBe(50);
    expect(parsePageSize("", 50)).toBe(50);
  });

  it("falls back rather than passing NaN into the query", () => {
    expect(parsePageSize("abc", 50)).toBe(50);
    expect(parsePageSize("1e", 50)).toBe(50);
  });

  it("caps the page so an unauthenticated caller cannot ask for the world", () => {
    expect(parsePageSize("1000000", 50)).toBe(MAX_CATALOG_PAGE_SIZE);
    expect(parsePageSize("Infinity", 50)).toBe(50);
  });

  it("refuses zero and negative sizes, which are not a valid page", () => {
    expect(parsePageSize("0", 50)).toBe(1);
    expect(parsePageSize("-10", 50)).toBe(1);
  });

  it("truncates fractional sizes", () => {
    expect(parsePageSize("10.9", 50)).toBe(10);
  });
});

describe("parseOffset", () => {
  it("passes through a sane offset", () => {
    expect(parseOffset("500")).toBe(500);
  });

  it("treats absent, non-numeric and negative offsets as the start", () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset("abc")).toBe(0);
    expect(parseOffset("-5")).toBe(0);
  });

  it("is not capped, so deep pagination still reaches the whole catalogue", () => {
    expect(parseOffset("100000")).toBe(100_000);
  });
});

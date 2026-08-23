import { describe, expect, it } from "vitest";
import {
  canonicalizePath,
  pathFromSegments,
  segmentsFromPath,
  withTrailingSlash,
} from "./paths";

describe("canonicalizePath", () => {
  it("strips the live WordPress host, query, hash and trailing slash", () => {
    expect(
      canonicalizePath(
        "https://www.greatwestgraphics.com/Screen-Printing-Tsawwassen/?utm=1#top",
      ),
    ).toBe("/screen-printing-tsawwassen");
  });

  it("keeps nested decoration-process slugs", () => {
    expect(
      canonicalizePath(
        "/decoration-processes/embroidery/vancouver/",
      ),
    ).toBe("/decoration-processes/embroidery/vancouver");
  });

  it("leaves the homepage as a single slash", () => {
    expect(canonicalizePath("/")).toBe("/");
    expect(canonicalizePath("https://greatwestgraphics.com/")).toBe("/");
  });

  it("decodes a percent-encoded slug", () => {
    expect(canonicalizePath("/t-shirt%20printing-2")).toBe(
      "/t-shirt printing-2",
    );
  });
});

describe("path segments", () => {
  it("round-trips a nested path", () => {
    const path = "/t-shirt-printing/t-shirt-printing-in-vancouver";
    expect(pathFromSegments(segmentsFromPath(path))).toBe(path);
  });

  it("adds a trailing slash except on the homepage", () => {
    expect(withTrailingSlash("/shop")).toBe("/shop/");
    expect(withTrailingSlash("/")).toBe("/");
  });
});

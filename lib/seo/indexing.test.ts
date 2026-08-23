import { afterEach, describe, expect, it } from "vitest";
import { allowSearchIndexing, publicRobots } from "./indexing";

const ORIGINAL = process.env.SEO_ALLOW_INDEX;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SEO_ALLOW_INDEX;
  else process.env.SEO_ALLOW_INDEX = ORIGINAL;
});

describe("allowSearchIndexing", () => {
  it("stays off until launch flips the flag", () => {
    delete process.env.SEO_ALLOW_INDEX;
    expect(allowSearchIndexing()).toBe(false);
    process.env.SEO_ALLOW_INDEX = "true";
    expect(allowSearchIndexing()).toBe(true);
    process.env.SEO_ALLOW_INDEX = "false";
    expect(allowSearchIndexing()).toBe(false);
  });

  it("noindexes flagged or pre-launch pages", () => {
    delete process.env.SEO_ALLOW_INDEX;
    expect(publicRobots(true)).toEqual({ index: false, follow: true });
    process.env.SEO_ALLOW_INDEX = "true";
    expect(publicRobots(true)).toEqual({ index: true, follow: true });
    expect(publicRobots(false)).toEqual({ index: false, follow: true });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { allowSearchIndexing, publicRobots } from "./indexing";

const ORIGINAL_FLAG = process.env.SEO_ALLOW_INDEX;
const ORIGINAL_SITE = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.SEO_ALLOW_INDEX;
  else process.env.SEO_ALLOW_INDEX = ORIGINAL_FLAG;
  if (ORIGINAL_SITE === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE;
});

describe("allowSearchIndexing", () => {
  it("stays off until launch flips the flag on a production host", () => {
    delete process.env.SEO_ALLOW_INDEX;
    expect(allowSearchIndexing()).toBe(false);
    process.env.SEO_ALLOW_INDEX = "true";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(allowSearchIndexing()).toBe(false);
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.greatwestgraphics.com";
    expect(allowSearchIndexing()).toBe(false);
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.greatwestgraphics.com";
    expect(allowSearchIndexing()).toBe(true);
    process.env.SEO_ALLOW_INDEX = "false";
    expect(allowSearchIndexing()).toBe(false);
  });

  it("noindexes flagged or pre-launch pages", () => {
    delete process.env.SEO_ALLOW_INDEX;
    expect(publicRobots(true)).toEqual({ index: false, follow: true });
    process.env.SEO_ALLOW_INDEX = "true";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.greatwestgraphics.com";
    expect(publicRobots(true)).toEqual({ index: true, follow: true });
    expect(publicRobots(false)).toEqual({ index: false, follow: true });
  });
});

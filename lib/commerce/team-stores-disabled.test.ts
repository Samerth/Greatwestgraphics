import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SHOW_TEAM_STORES } from "@/lib/features";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const features = read("lib/features.ts");
const context = stripComments(read("lib/commerce/store-context.ts"));
const slugRoute = stripComments(read("app/s/[slug]/route.ts"));
const startPage = stripComments(read("app/(shop)/start/page.tsx"));
const teamPage = stripComments(read("app/(shop)/account/team/page.tsx"));
const createApi = stripComments(read("app/api/stores/create/route.ts"));
const portalLayout = stripComments(read("app/portal/layout.tsx"));
const portalJobs = stripComments(read("app/portal/jobs/page.tsx"));

/**
 * CodSphere UAT V2 row 51: "For now disable team stores and we will discuss
 * the correct workflow." Row 52 then replaces the feature entirely.
 *
 * The requirement is specifically to hide it without losing it — the code,
 * routes and data all stay, so row 52 is a rebuild from a working feature
 * rather than from nothing.
 */
describe("branded team stores are off for the first deployment", () => {
  it("is off", () => {
    expect(SHOW_TEAM_STORES).toBe(false);
  });

  it("is a flag, so the feature can be restored rather than rebuilt", () => {
    expect(features).toContain("export const SHOW_TEAM_STORES");
    // The file's own contract: engines and routes stay in the repo.
    expect(features).toMatch(/Engines and routes stay in the repo/);
  });
});

describe("no request can pick up a branded store while it is off", () => {
  it("gates the one place a store enters a request", () => {
    // Everything downstream — banners, branding, store-scoped catalogue —
    // reads from resolveStoreContext. Gating here is what makes a stale
    // cookie from before the flag flipped harmless.
    expect(context).toContain("if (SHOW_TEAM_STORES) {");
    expect(context).toMatch(/SHOW_TEAM_STORES[\s\S]{0,200}?selectedStore\(/);
  });

  it("closes the /s/<slug> entry point with a 404", () => {
    expect(slugRoute).toContain("if (!SHOW_TEAM_STORES)");
    expect(slugRoute).toMatch(/status: 404/);
  });
});

describe("a store cannot be created while it is off", () => {
  it("hides the creation wizard", () => {
    expect(startPage).toContain("if (!SHOW_TEAM_STORES) notFound();");
  });

  it("also refuses at the endpoint, not just in the UI", () => {
    // A hidden button is not a closed door.
    expect(createApi).toContain("if (!SHOW_TEAM_STORES)");
    expect(createApi).toMatch(/status: 404/);
  });

  it("hides the store administration page", () => {
    expect(teamPage).toContain("if (!SHOW_TEAM_STORES) notFound();");
  });
});

describe("nothing customer-facing links into it", () => {
  it("drops the Your Team link and the back-to-store link in the portal", () => {
    expect(portalLayout).toMatch(
      /const showTeam =\s*\n?\s*SHOW_TEAM_STORES && teamMemberships/,
    );
    expect(portalLayout).toMatch(/SHOW_TEAM_STORES && scope\.usingTeam/);
  });

  it("drops the cross-links to other stores on the jobs list", () => {
    expect(portalJobs).toContain("const otherTeams = !SHOW_TEAM_STORES");
  });
});

describe("the feature is hidden, not deleted", () => {
  const kept = [
    "app/s/[slug]/route.ts",
    "app/(shop)/start/page.tsx",
    "app/(shop)/account/team/page.tsx",
    "app/api/stores/create/route.ts",
    "app/admin/accounts/page.tsx",
    "app/admin/accounts/[storeId]/page.tsx",
    "lib/commerce/store-context.ts",
    "lib/commerce/store-cookie.ts",
  ];

  it("keeps every route and module in the repository", () => {
    // Row 52 rebuilds this. Deleting it now would turn that into a salvage
    // job, and the client asked for the codebase to be kept.
    for (const file of kept) {
      expect(() => read(file), `${file} was removed`).not.toThrow();
    }
  });

  it("keeps the store selection logic itself intact", () => {
    expect(context).toContain("selectedStore");
    expect(context).toContain("STORE_COOKIE");
  });
});

describe("the account menu carries no link into it either", () => {
  // Missed on the first pass: the pages were closed but the header's account
  // dropdown still offered "Team store — create or invite people to a branded
  // store", on desktop and mobile. Found by the user on 15 Sep.
  const header = stripComments(read("components/layout/Header.tsx"));

  it("gates the desktop menu entry", () => {
    expect(header).toMatch(/SHOW_TEAM_STORES && \(\s*<Link\s+href="\/account\/team"/);
  });

  it("gates the mobile menu entry", () => {
    expect((header.match(/SHOW_TEAM_STORES && \(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("hides the Corporate & Team Stores rail in the Shop menu", () => {
    // The Shop mega menu's right rail carried one tile, "Corporate & Team
    // Stores - Branded stores with per-store pricing", linking into the
    // closed /start flow. Found by the user on 15 Sep, after the account
    // menu fix.
    expect(header).toMatch(/CORPORATE_SERVICE = SHOW_TEAM_STORES\s*\?/);
    expect(header).toContain("CORPORATE_SERVICE.length > 0 &&");
  });

  it("offers no ungated route into the store pages anywhere in the header", () => {
    // Every /account/team link must sit inside a SHOW_TEAM_STORES guard.
    const links = header.split('href="/account/team"').length - 1;
    const guarded = (header.match(/SHOW_TEAM_STORES && \(\s*<Link\s+href="\/account\/team"/g) ?? []).length;
    expect(links).toBe(guarded);
  });
});

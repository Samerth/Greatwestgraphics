import { describe, expect, it } from "vitest";
import {
  destinationAfterSignIn,
  existingTeamStorePath,
  pickPortalStore,
  teamMemberships,
} from "./membership";

const PUBLIC = {
  accountId: "retail-account",
  storeId: "retail-store",
  storeSlug: "great-west-graphics",
  storeName: "Great West Graphics",
  storeStatus: "active",
  storeIsPublic: true,
  role: "member",
};

const ACME = {
  accountId: "acme-account",
  storeId: "acme-store",
  storeSlug: "acme",
  storeName: "Acme",
  storeStatus: "active",
  storeIsPublic: false,
  role: "owner",
};

const BETA = {
  accountId: "beta-account",
  storeId: "beta-store",
  storeSlug: "beta",
  storeName: "Beta",
  storeStatus: "pending_review",
  storeIsPublic: false,
  role: "member",
};

describe("teamMemberships", () => {
  it("drops the public retail membership every shopper holds", () => {
    expect(teamMemberships([PUBLIC, ACME])).toEqual([ACME]);
  });
});

describe("existingTeamStorePath", () => {
  it("keeps a first-time owner on the create-store wizard", () => {
    expect(existingTeamStorePath([PUBLIC])).toBeNull();
  });

  it("opens an approved team store instead of asking for details again", () => {
    expect(existingTeamStorePath([PUBLIC, ACME])).toBe("/s/acme");
  });

  it("sends a store still awaiting review to the pending screen", () => {
    expect(existingTeamStorePath([PUBLIC, BETA])).toBe("/start/pending");
  });

  it("prefers the live store when one team is approved and another is not", () => {
    expect(existingTeamStorePath([PUBLIC, BETA, ACME])).toBe("/s/acme");
  });

  it("sends a suspended team store to the team page instead of the wizard", () => {
    expect(
      existingTeamStorePath([
        PUBLIC,
        { ...ACME, storeStatus: "suspended" },
      ]),
    ).toBe("/account/team");
  });
});

describe("destinationAfterSignIn", () => {
  it("opens the owner's branded store after a generic corporate login", () => {
    expect(destinationAfterSignIn("/start", [PUBLIC, ACME])).toBe("/s/acme");
    expect(destinationAfterSignIn(undefined, [PUBLIC, ACME])).toBe("/s/acme");
  });

  it("keeps a first-time corporate owner on the wizard", () => {
    expect(destinationAfterSignIn("/start", [PUBLIC])).toBe("/start");
  });

  it("opens checkout inside the owner's store so they stay on their storefront", () => {
    expect(destinationAfterSignIn("/checkout", [PUBLIC, ACME])).toBe(
      "/s/acme?next=%2Fcheckout",
    );
  });

  it("leaves a retail shopper on the portal", () => {
    expect(destinationAfterSignIn(undefined, [PUBLIC])).toBe("/portal/jobs");
  });
});

describe("pickPortalStore", () => {
  it("stays on the public shop when the person has no team", () => {
    expect(
      pickPortalStore({ storeId: PUBLIC.storeId, isPublic: true }, [PUBLIC]),
    ).toBeNull();
  });

  it("follows a team-store cookie when the visitor already belongs there", () => {
    expect(
      pickPortalStore({ storeId: ACME.storeId, isPublic: false }, [PUBLIC, ACME, BETA]),
    ).toEqual(ACME);
  });

  it("picks the team store after the visitor left for the main site", () => {
    expect(
      pickPortalStore({ storeId: PUBLIC.storeId, isPublic: true }, [PUBLIC, ACME]),
    ).toEqual(ACME);
  });

  it("prefers an active team store over one still awaiting review", () => {
    expect(
      pickPortalStore({ storeId: PUBLIC.storeId, isPublic: true }, [PUBLIC, BETA, ACME]),
    ).toEqual(ACME);
  });
});

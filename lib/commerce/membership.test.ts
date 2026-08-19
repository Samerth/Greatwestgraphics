import { describe, expect, it } from "vitest";
import { pickPortalStore, teamMemberships } from "./membership";

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

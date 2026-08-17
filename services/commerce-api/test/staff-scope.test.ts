import { describe, expect, it } from "vitest";
import { staffScopedContext } from "../src/domain/staff-scope.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "99999999-9999-4999-8999-999999999999";
const HEAD_OFFICE = "22222222-2222-4222-8222-222222222222";
const MAIN_STORE = "33333333-3333-4333-8333-333333333333";
const TEAM_ACCOUNT = "44444444-4444-4444-8444-444444444444";
const TEAM_STORE = "55555555-5555-4555-8555-555555555555";

class Refused extends Error {}
const refuse = () => new Refused("scope mismatch");

const headOffice = {
  tenantId: TENANT,
  accountId: HEAD_OFFICE,
  storeId: MAIN_STORE,
};
const teamStoreJob = { accountId: TEAM_ACCOUNT, storeId: TEAM_STORE };

describe("staffScopedContext", () => {
  it("redirects a staff write onto the account that owns the job", () => {
    // The bug this exists to prevent: staff sit in head office's account, a
    // branded team store owns its orders in its own, so an account-equality
    // check refused every corporate order and nobody could fulfil them.
    expect(staffScopedContext(TENANT, headOffice, teamStoreJob, refuse)).toEqual(
      {
        tenantId: TENANT,
        accountId: TEAM_ACCOUNT,
        storeId: TEAM_STORE,
      },
    );
  });

  it("keeps a main-store job on the main store", () => {
    expect(
      staffScopedContext(
        TENANT,
        headOffice,
        { accountId: HEAD_OFFICE, storeId: MAIN_STORE },
        refuse,
      ),
    ).toEqual(headOffice);
  });

  it("ignores an account the caller names in the body", () => {
    // The owner comes from the job row, so a forged payload cannot point a
    // staff write at an account that does not own the job.
    const forged = {
      tenantId: TENANT,
      accountId: "66666666-6666-4666-8666-666666666666",
      storeId: "77777777-7777-4777-8777-777777777777",
    };
    expect(staffScopedContext(TENANT, forged, teamStoreJob, refuse)).toEqual({
      tenantId: TENANT,
      accountId: TEAM_ACCOUNT,
      storeId: TEAM_STORE,
    });
  });

  it("still refuses to cross a tenant boundary", () => {
    // Widening from account to tenant is the whole change; widening past the
    // tenant would hand one client's jobs to another's staff.
    expect(() =>
      staffScopedContext(
        OTHER_TENANT,
        headOffice,
        teamStoreJob,
        refuse,
      ),
    ).toThrow(Refused);
  });

  it("raises the caller's error type so route status codes are unchanged", () => {
    expect(() =>
      staffScopedContext(OTHER_TENANT, headOffice, teamStoreJob, refuse),
    ).toThrow("scope mismatch");
  });

  it("carries any extra context fields through untouched", () => {
    const withExtras = { ...headOffice, requestId: "abc" };
    expect(
      staffScopedContext(TENANT, withExtras, teamStoreJob, refuse),
    ).toMatchObject({ requestId: "abc", accountId: TEAM_ACCOUNT });
  });
});

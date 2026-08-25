import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findActiveVendorRun,
  isRunForCurrentStart,
  liveSyncCopy,
  mergePendingSyncRun,
  shouldPollSyncRuns,
  startErrorToShow,
  syncButtonLabel,
  syncTypeLabel,
  vendorButtonsLocked,
} from "./catalog-sync-feedback";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const intent = { vendor: "sanmar", type: "inventory", at: 1_700_000_000_000 };

describe("syncTypeLabel", () => {
  it("uses staff-facing names for inventory vs full", () => {
    expect(syncTypeLabel("inventory")).toBe("stock & price");
    expect(syncTypeLabel("full")).toBe("full");
    expect(syncTypeLabel("csv_import")).toBe("CSV import");
  });
});

describe("liveSyncCopy", () => {
  it("does not invent a progress percentage", () => {
    expect(
      liveSyncCopy({
        phase: "starting",
        vendorName: "Sanmar / ATC",
        type: "inventory",
      }),
    ).toBe("Starting… Sanmar / ATC · stock & price");
    expect(
      liveSyncCopy({
        phase: "running",
        vendorName: "Sanmar / ATC",
        type: "full",
        startedAt: "2026-08-25T12:00:00.000Z",
      }),
    ).toMatch(/^Running… Sanmar \/ ATC · full · started /);
    expect(
      liveSyncCopy({
        phase: "running",
        vendorName: "S&S Activewear Canada",
        type: "inventory",
      }),
    ).not.toMatch(/%/);
  });
});

describe("isRunForCurrentStart / mergePendingSyncRun", () => {
  it("treats a running row for the same vendor+type as the started job", () => {
    const run = {
      id: "r1",
      vendor: "sanmar",
      type: "inventory",
      status: "running",
      startedAt: "2020-01-01T00:00:00.000Z",
    };
    expect(isRunForCurrentStart(run, intent)).toBe(true);
    expect(mergePendingSyncRun([run], intent)).toEqual([run]);
  });

  it("ignores an old completed row and inserts a starting placeholder", () => {
    const old = {
      id: "old",
      vendor: "sanmar",
      type: "inventory",
      status: "completed",
      startedAt: "2020-01-01T00:00:00.000Z",
    };
    const merged = mergePendingSyncRun([old], intent);
    expect(merged[0]).toMatchObject({
      vendor: "sanmar",
      type: "inventory",
      status: "starting",
    });
    expect(merged[1]).toEqual(old);
  });

  it("matches a completed row that started with this click", () => {
    const run = {
      id: "fast",
      vendor: "sanmar",
      type: "inventory",
      status: "completed",
      startedAt: new Date(intent.at + 50).toISOString(),
    };
    expect(isRunForCurrentStart(run, intent)).toBe(true);
  });
});

describe("lock and poll", () => {
  const running = {
    id: "r",
    vendor: "sanmar",
    type: "full",
    status: "running",
  };

  it("locks that vendor while starting or running, not the other vendor", () => {
    expect(vendorButtonsLocked("sanmar", intent, [])).toBe(true);
    expect(vendorButtonsLocked("ss_activewear", intent, [])).toBe(false);
    expect(vendorButtonsLocked("sanmar", null, [running])).toBe(true);
    expect(vendorButtonsLocked("ss_activewear", null, [running])).toBe(false);
  });

  it("polls while starting or any run is still running", () => {
    expect(shouldPollSyncRuns(intent, [])).toBe(true);
    expect(shouldPollSyncRuns(null, [running])).toBe(true);
    expect(
      shouldPollSyncRuns(null, [{ ...running, status: "completed" }]),
    ).toBe(false);
  });

  it("finds the newest running row for a vendor", () => {
    expect(findActiveVendorRun([running], "sanmar")).toEqual(running);
    expect(findActiveVendorRun([running], "ss_activewear")).toBeUndefined();
  });
});

describe("startErrorToShow", () => {
  it("hides errors while Starting… is showing", () => {
    expect(startErrorToShow("Vendor is not configured", intent, [])).toBeUndefined();
  });

  it("hides a start timeout when that vendor job is already running", () => {
    expect(
      startErrorToShow(
        "The review service is unavailable.",
        null,
        [
          {
            vendor: "sanmar",
            type: "inventory",
            status: "running",
          },
        ],
        { vendor: "sanmar", type: "inventory" },
      ),
    ).toBeUndefined();
  });

  it("shows a real start failure after the attempt ends", () => {
    expect(startErrorToShow("Vendor is not configured", null, [])).toBe(
      "Vendor is not configured",
    );
  });
});

describe("syncButtonLabel", () => {
  it("switches Starting… then Running… for the clicked action only", () => {
    expect(
      syncButtonLabel({
        idleLabel: "Full sync",
        vendorKey: "sanmar",
        type: "full",
        intent: { vendor: "sanmar", type: "full", at: intent.at },
        formPending: true,
      }),
    ).toBe("Starting…");
    expect(
      syncButtonLabel({
        idleLabel: "Update stock & price",
        vendorKey: "sanmar",
        type: "inventory",
        intent: { vendor: "sanmar", type: "full", at: intent.at },
        formPending: false,
        activeRun: {
          vendor: "sanmar",
          type: "full",
          status: "running",
        },
      }),
    ).toBe("Update stock & price");
    expect(
      syncButtonLabel({
        idleLabel: "Full sync",
        vendorKey: "sanmar",
        type: "full",
        intent: null,
        formPending: false,
        activeRun: {
          vendor: "sanmar",
          type: "full",
          status: "running",
        },
      }),
    ).toBe("Running…");
  });
});

describe("admin sync chrome", () => {
  it("gives Full sync / stock & price immediate pending and live run polling", () => {
    const helper = read("lib/admin/catalog-sync-feedback.ts");
    const panel = read("components/admin/CatalogSyncPanel.tsx");
    const page = read("app/admin/sync/page.tsx");
    const api = read("app/api/admin/sync-runs/route.ts");
    const commerce = read("services/commerce-api/src/app.ts");
    expect(helper).toContain("Starting…");
    expect(helper).toContain("Running…");
    expect(panel).toContain("syncButtonLabel");
    expect(panel).toContain("/api/admin/sync-runs");
    expect(panel).not.toContain("Colours in the design");
    expect(page).toContain("CatalogSyncPanel");
    expect(page).not.toContain("Colours in the design");
    expect(api).toContain("listSyncRuns");
    expect(commerce).toContain("accepted: true");
    expect(commerce).toContain("void adapter.runInventorySync");
    expect(commerce).toContain("void adapter.runFullSync");
  });
});

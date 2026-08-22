import { describe, expect, it } from "vitest";
import {
  postgresSqlState,
  schemaDriftMessage,
} from "../src/db/postgres-error.js";

describe("postgres error helpers", () => {
  it("reads a postgres.js SQLSTATE off the error itself", () => {
    const error = Object.assign(new Error('column "last_crm_sync_at" does not exist'), {
      code: "42703",
    });
    expect(postgresSqlState(error)).toBe("42703");
    expect(schemaDriftMessage(error)).toBe(
      "The database is missing column last_crm_sync_at. Apply pending Drizzle migrations.",
    );
  });

  it("walks a wrapped cause", () => {
    const cause = Object.assign(new Error('column "payment_status" does not exist'), {
      code: "42703",
    });
    const error = new Error("Failed query");
    (error as Error & { cause: unknown }).cause = cause;
    expect(postgresSqlState(error)).toBe("42703");
    expect(schemaDriftMessage(error)).toBe(
      "The database is missing column payment_status. Apply pending Drizzle migrations.",
    );
  });

  it("ignores application error codes that are not SQLSTATE", () => {
    const error = Object.assign(new Error("Job request not found in this tenant"), {
      code: "NOT_FOUND",
    });
    expect(postgresSqlState(error)).toBeUndefined();
    expect(schemaDriftMessage(error)).toBeUndefined();
  });
});

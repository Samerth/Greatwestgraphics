import { describe, expect, it } from "vitest";
import type { Actor } from "@gwg/contracts";
import {
  customerScopeForActor,
  requireCustomerScope,
} from "../src/domain/customer-scope.js";

const PERSON = "44444444-4444-4444-8444-444444444444";

class Refused extends Error {}
const refuse = () => new Refused("no identified customer");

describe("customerScopeForActor", () => {
  it("narrows an identified customer to their own person id", () => {
    const actor: Actor = { type: "customer", id: PERSON };
    expect(customerScopeForActor(actor)).toEqual({
      kind: "customer",
      personId: PERSON,
    });
  });

  it("leaves staff unnarrowed, because reviewing the account is their job", () => {
    const actor: Actor = { type: "staff", id: PERSON, displayName: "Staff" };
    expect(customerScopeForActor(actor)).toEqual({ kind: "staff" });
  });

  it("reports a customer with no id as unidentified rather than as staff", () => {
    // The whole point of the three-way result: an anonymous customer and a
    // staff member both lack a person filter, and treating them alike is what
    // handed one shopper every other shopper's jobs.
    const actor: Actor = { type: "customer", id: undefined };
    expect(customerScopeForActor(actor)).toEqual({ kind: "unidentified" });
  });

  it("treats a system actor as unnarrowed staff", () => {
    const actor = { type: "system", id: undefined } as unknown as Actor;
    expect(customerScopeForActor(actor)).toEqual({ kind: "staff" });
  });
});

describe("requireCustomerScope", () => {
  it("returns the person id for an identified customer", () => {
    expect(
      requireCustomerScope({ type: "customer", id: PERSON }, refuse),
    ).toBe(PERSON);
  });

  it("returns undefined for staff so the query stays account-wide", () => {
    expect(
      requireCustomerScope(
        { type: "staff", id: PERSON, displayName: "Staff" },
        refuse,
      ),
    ).toBeUndefined();
  });

  it("throws instead of falling back to account scope", () => {
    // A returned `undefined` here would silently widen the query to every
    // customer in the shared public account.
    expect(() =>
      requireCustomerScope({ type: "customer", id: undefined }, refuse),
    ).toThrow(Refused);
  });

  it("raises the caller's own error type so route status codes are unchanged", () => {
    expect(() =>
      requireCustomerScope({ type: "customer", id: undefined }, refuse),
    ).toThrow("no identified customer");
  });
});

import { describe, expect, it } from "vitest";
import { FulfillmentSnapshotSchema } from "@gwg/contracts";

describe("FulfillmentSnapshotSchema", () => {
  it("allows studio pickup without a shipping address", () => {
    const parsed = FulfillmentSnapshotSchema.parse({
      method: "pickup",
      deliveryNotes: "Sam will collect Friday",
    });
    expect(parsed.address).toBeUndefined();
    expect(parsed.deliveryNotes).toBe("Sam will collect Friday");
  });

  it("still accepts pickup with a leftover address", () => {
    const parsed = FulfillmentSnapshotSchema.parse({
      method: "pickup",
      address: {
        address1: "123 Test Street",
        city: "Vancouver",
        region: "BC",
        postalCode: "V6A 1A1",
        country: "Canada",
      },
    });
    expect(parsed.address?.city).toBe("Vancouver");
  });

  it("requires an address for shipped methods", () => {
    const result = FulfillmentSnapshotSchema.safeParse({
      method: "priority",
    });
    expect(result.success).toBe(false);
  });
});

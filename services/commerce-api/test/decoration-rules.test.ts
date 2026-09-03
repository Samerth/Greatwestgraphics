import { describe, expect, it } from "vitest";
import {
  resolveDecorationRules,
  type CategoryDecorationRule,
} from "../src/application/decoration-rules.js";

describe("resolveDecorationRules", () => {
  it("is unrestricted when no category in the chain has a rule", () => {
    expect(resolveDecorationRules([])).toEqual({ methods: null, locations: null });
    expect(
      resolveDecorationRules([
        { allowedDecorationMethods: null, allowedDecorationLocations: null },
        { allowedDecorationMethods: undefined, allowedDecorationLocations: [] },
      ]),
    ).toEqual({ methods: null, locations: null });
  });

  it("applies a department's rule to every product filed under it", () => {
    // Hats: no Screen Print, only Embroidery / heat-transfer.
    const hats: CategoryDecorationRule = {
      allowedDecorationMethods: ["embroidery", "heatTransfer"],
      allowedDecorationLocations: ["front", "back"],
    };
    expect(resolveDecorationRules([hats])).toEqual({
      methods: ["embroidery", "heatTransfer"],
      locations: ["front", "back"],
    });
  });

  it("prefers the more specific (direct) category's rule over its parent's", () => {
    const directSubcategory: CategoryDecorationRule = {
      allowedDecorationMethods: ["embroidery"],
      allowedDecorationLocations: null,
    };
    const parentDepartment: CategoryDecorationRule = {
      allowedDecorationMethods: ["screenPrint", "embroidery", "dtf"],
      allowedDecorationLocations: ["front", "back", "leftChest", "sleeve"],
    };
    // Direct wins for methods (it has one); parent's location rule is used
    // since the direct category left locations unrestricted.
    expect(resolveDecorationRules([directSubcategory, parentDepartment])).toEqual({
      methods: ["embroidery"],
      locations: ["front", "back", "leftChest", "sleeve"],
    });
  });

  it("resolves methods and locations independently from different categories in the chain", () => {
    const bags: CategoryDecorationRule = {
      allowedDecorationMethods: null,
      allowedDecorationLocations: ["front", "back"],
    };
    expect(resolveDecorationRules([bags])).toEqual({
      methods: null,
      locations: ["front", "back"],
    });
  });
});

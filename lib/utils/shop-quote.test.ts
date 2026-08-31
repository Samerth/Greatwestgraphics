import { describe, expect, it } from "vitest";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import {
  colourOptions,
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
  stitchCountForPreset,
} from "./shop-quote";

describe("shop quote method helpers", () => {
  const methods = enabledDecorationMethods(PRICING_MASTER_V2);
  const screen = methods.find((method) => method.key === "screenPrint");
  const embroidery = methods.find((method) => method.key === "embroidery");
  const dtf = methods.find((method) => method.key === "dtf");

  it("exposes the published methods the admin calculator uses", () => {
    expect(methods.map((method) => method.key)).toEqual(
      expect.arrayContaining(["screenPrint", "embroidery", "dtf"]),
    );
  });

  it("asks for colours, stitches or transfer size from the rate model", () => {
    expect(methodVariableInputs(screen)).toEqual({
      colours: true,
      stitches: false,
      option: false,
    });
    expect(methodVariableInputs(embroidery)).toEqual({
      colours: false,
      stitches: true,
      option: false,
    });
    expect(methodVariableInputs(dtf)).toEqual({
      colours: false,
      stitches: false,
      option: true,
    });
    expect(colourOptions(screen)[0]).toBe(1);
    expect(defaultOptionKey(dtf)).toBeTruthy();
    expect(stitchCountForPreset("medium")).toBe(10000);
  });
});

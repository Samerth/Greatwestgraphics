import { describe, expect, it } from "vitest";
import { containsBannedPhone } from "./clean";
import {
  GWG_PHONE_DISPLAY,
  GWG_PHONE_TEL,
  normalizePhoneDisplay,
  toTelHref,
} from "./phone";

describe("phone normalization", () => {
  it("keeps the live shop number", () => {
    expect(GWG_PHONE_DISPLAY).toBe("604-321-3285");
    expect(GWG_PHONE_TEL).toBe("+16043213285");
  });

  it("rewrites the Maple Ridge typo and spaced/dotted variants", () => {
    expect(normalizePhoneDisplay("Call 604-331-3285 today")).toBe(
      `Call ${GWG_PHONE_DISPLAY} today`,
    );
    expect(normalizePhoneDisplay("Ph 604 321 3285")).toBe(
      `Ph ${GWG_PHONE_DISPLAY}`,
    );
    expect(normalizePhoneDisplay("604.321.3285")).toBe(GWG_PHONE_DISPLAY);
    expect(containsBannedPhone(normalizePhoneDisplay("604-331-3285"))).toBe(
      false,
    );
  });

  it("builds tel: hrefs from display or typo numbers", () => {
    expect(toTelHref("604-321-3285")).toBe(GWG_PHONE_TEL);
    expect(toTelHref("(604) 321-3285")).toBe(GWG_PHONE_TEL);
    expect(toTelHref("604-331-3285")).toBe(GWG_PHONE_TEL);
    expect(toTelHref("+1 604 321 3285")).toBe(GWG_PHONE_TEL);
  });
});

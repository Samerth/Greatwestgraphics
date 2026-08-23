import { describe, expect, it } from "vitest";
import {
  canReadUploadedObject,
  isPublicUploadKey,
  isSafeUploadKey,
  parseUploadPurpose,
  uploadObjectKey,
} from "./upload-access";

const PERSON = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const OBJECT = "33333333-3333-4333-8333-333333333333";

describe("parseUploadPurpose", () => {
  it("defaults missing or design values to private artwork", () => {
    expect(parseUploadPurpose(null)).toBe("design");
    expect(parseUploadPurpose("")).toBe("design");
    expect(parseUploadPurpose("design")).toBe("design");
  });

  it("accepts store-logo and rejects anything else", () => {
    expect(parseUploadPurpose("store-logo")).toBe("store-logo");
    expect(parseUploadPurpose("avatar")).toBeNull();
  });
});

describe("uploadObjectKey", () => {
  it("files store logos under designs/ so the staging task role can PutObject", () => {
    expect(uploadObjectKey("store-logo", PERSON, OBJECT, "png")).toBe(
      `designs/${PERSON}/store-logo-${OBJECT}.png`,
    );
  });

  it("keeps design artwork under the private customer prefix", () => {
    expect(uploadObjectKey("design", PERSON, OBJECT, "svg")).toBe(
      `designs/${PERSON}/${OBJECT}.svg`,
    );
  });
});

describe("upload key access", () => {
  it("rejects path traversal before any prefix check", () => {
    expect(isSafeUploadKey("store-logos/../designs/secret.png")).toBe(false);
    expect(isPublicUploadKey("store-logos/../designs/secret.png")).toBe(false);
    expect(
      canReadUploadedObject("store-logos/../designs/secret.png", {
        isStaff: true,
        personId: PERSON,
      }),
    ).toBe(false);
  });

  it("lets anyone read a store logo, including the original store-logos/ prefix", () => {
    const key = `designs/${PERSON}/store-logo-${OBJECT}.png`;
    expect(isPublicUploadKey(key)).toBe(true);
    expect(canReadUploadedObject(key, { isStaff: false })).toBe(true);
    expect(
      canReadUploadedObject(`store-logos/${PERSON}/${OBJECT}.png`, {
        isStaff: false,
      }),
    ).toBe(true);
  });

  it("keeps customer artwork private to the owner or staff", () => {
    const key = `designs/${PERSON}/${OBJECT}.png`;
    expect(isPublicUploadKey(key)).toBe(false);
    expect(canReadUploadedObject(key, { isStaff: false })).toBe(false);
    expect(
      canReadUploadedObject(key, { isStaff: false, personId: OTHER }),
    ).toBe(false);
    expect(
      canReadUploadedObject(key, { isStaff: false, personId: PERSON }),
    ).toBe(true);
    expect(canReadUploadedObject(key, { isStaff: true })).toBe(true);
  });
});

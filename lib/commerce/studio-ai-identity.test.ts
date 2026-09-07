import { describe, expect, it } from "vitest";
import {
  buildStudioIdentityPrompt,
  fetchStudioIdentityBlob,
  isUsableStudioIdentityBlob,
  nextStudioIdentitySeed,
  normalizeStudioIdentityPrompt,
  studioIdentityFilename,
  studioIdentityImageUrl,
} from "./studio-ai-identity";

describe("studio AI identity (Pollinations)", () => {
  it("wraps the shopper prompt as a flat identity mark, not a scene", () => {
    const prompt = buildStudioIdentityPrompt("  mountain badge for staff  ");
    expect(prompt.startsWith("mountain badge for staff, ")).toBe(true);
    expect(prompt).toContain("isolated on pure white");
    expect(prompt).toContain("no photorealism");
    expect(prompt).toContain("no garment");
  });

  it("builds a no-logo Pollinations URL with a stable seed", () => {
    const url = studioIdentityImageUrl("wolf crest", 42);
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain("seed=42");
    expect(url).toContain("nologo=true");
    expect(url).toContain("width=1024");
    expect(decodeURIComponent(url)).toContain("wolf crest");
  });

  it("collapses prompt whitespace before wrapping", () => {
    expect(normalizeStudioIdentityPrompt("  wolf   head  ")).toBe("wolf head");
  });

  it("names the saved file from the prompt so they can keep it", () => {
    expect(studioIdentityFilename("Wolf Crest 2026")).toBe(
      "identity-wolf-crest-2026.png",
    );
    expect(studioIdentityFilename("Wolf Crest 2026", "image/jpeg")).toBe(
      "identity-wolf-crest-2026.jpg",
    );
    expect(studioIdentityFilename("???")).toBe("identity-mark.png");
  });

  it("fetches the generator URL and rejects a tiny payload", async () => {
    const url = studioIdentityImageUrl("wolf crest", 7);
    const fetchImpl: typeof fetch = async (input) => {
      expect(String(input)).toBe(url);
      return new Response(new Uint8Array(100), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    };
    await expect(fetchStudioIdentityBlob("wolf crest", 7, fetchImpl)).rejects.toThrow(
      /unusable/,
    );
  });

  it("returns a usable blob from a successful generator response", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(new Uint8Array(9_000), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    const blob = await fetchStudioIdentityBlob("wolf crest", 7, fetchImpl);
    expect(blob.size).toBe(9_000);
    expect(blob.type).toBe("image/png");
  });

  it("rejects tiny or non-image blobs", () => {
    expect(isUsableStudioIdentityBlob(new Blob(["x"], { type: "image/png" }))).toBe(
      false,
    );
    expect(
      isUsableStudioIdentityBlob(
        new Blob([new Uint8Array(9_000)], { type: "text/html" }),
      ),
    ).toBe(false);
    expect(
      isUsableStudioIdentityBlob(
        new Blob([new Uint8Array(9_000)], { type: "image/png" }),
      ),
    ).toBe(true);
  });

  it("does not call Math.random itself when a rng is passed", () => {
    expect(nextStudioIdentitySeed(() => 0.5)).toBe(500_000_000);
  });
});

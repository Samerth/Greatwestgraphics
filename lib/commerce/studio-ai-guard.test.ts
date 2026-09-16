import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  StudioAiGuardError,
  assertStudioAiPromptAllowed,
  findGuardedTerm,
} from "./studio-ai-guard";

/**
 * 16 Sep, with a real key: gpt-image-1, gpt-image-2 and gpt-image-2.5-flare
 * all drew a clean Nike swoosh with "Just Do It" on request. OpenAI's filter
 * does not treat trademarks as unsafe; the print shop has to.
 */
describe("what the guard stops", () => {
  it("catches the exact prompt that got through the model", () => {
    expect(findGuardedTerm("The Nike swoosh logo with the words Just Do It")).toBe("nike");
    expect(findGuardedTerm("Mickey Mouse waving, official Disney style")).toBe("disney");
  });

  it("catches brands however they are cased or spaced", () => {
    expect(findGuardedTerm("NIKE tee")).toBe("nike");
    expect(findGuardedTerm("a coca cola style script")).toBe("coca cola");
    expect(findGuardedTerm("Harley Davidson eagle")).toMatch(/^harley/);
    expect(findGuardedTerm("the Canucks orca")).toBe("canucks");
  });

  it("looks in every free-text field the panel sends", () => {
    expect(() =>
      assertStudioAiPromptAllowed({ purpose: "Team shirt for our Sunday league", subjects: "the Jumpman silhouette" }),
    ).toThrow(StudioAiGuardError);
  });

  it("only treats an everyday word as a brand when the customer means the brand", () => {
    // Real customers: an orchard, a wildlife society, a school team, a church.
    expect(findGuardedTerm("Apple Valley Roofing crew shirts")).toBeNull();
    expect(findGuardedTerm("a Canada goose for the wetlands society")).toBeNull();
    expect(findGuardedTerm("our school's Raptors basketball crest")).toBeNull();
    expect(findGuardedTerm("a dove with an olive branch for the church picnic")).toBeNull();
    expect(findGuardedTerm("a puma mascot leaping, one colour")).toBeNull();
    expect(findGuardedTerm("a logo for our YouTube channel about fishing")).toBeNull();
    // The same words when the brand's own mark is meant.
    expect(findGuardedTerm("the Apple logo on the chest")).toBe("apple logo");
    expect(findGuardedTerm("the official Puma logo")).toBe("puma");
    expect(findGuardedTerm("the Toronto Raptors logo")).toBe("toronto raptors");
    expect(findGuardedTerm("the YouTube logo on the back")).toBe("youtube logo");
  });

  it("does not fire on ordinary print-shop prompts", () => {
    for (const prompt of [
      "Bold badge logo for a community soccer club called Riverside FC",
      "Minimal line-art logo of a loaf of bread with a rolling pin",
      "Hunting club emblem with a deer head and crossed rifles",
      "Craft brewery logo with a hop cone and a pint glass",
      "Retro varsity lettering that reads GREAT WEST",
      "Skull with flames for a metal band",
      "Cannabis leaf logo for a dispensary",
      "Our school's mascot, a blue heron, for the grade 12 hoodie",
      "A pumpkin with a top hat for the fall market",
    ]) {
      expect(findGuardedTerm(prompt), prompt).toBeNull();
    }
  });

  it("does not fire on a word that merely contains a brand", () => {
    // "sprite" inside "spritely", "gap" inside "gaping", "ford" inside "Bradford".
    expect(findGuardedTerm("a spritely fox mascot")).toBeNull();
    expect(findGuardedTerm("Bradford Roofing")).toBeNull();
    expect(findGuardedTerm("gaping mouth cartoon")).toBeNull();
  });

  it("tells the customer why, and what to do instead", () => {
    let message = "";
    try {
      assertStudioAiPromptAllowed({ purpose: "Nike swoosh please" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/trademarked/i);
    expect(message).toMatch(/"nike"/);
    expect(message).toMatch(/Describe your own mark/);
  });
});

describe("the guard sits before any spend", () => {
  const route = readFileSync(resolve(process.cwd(), "app/api/studio/identity/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("runs on the parsed body before the prompt is built", () => {
    const guard = route.indexOf("assertStudioAiPromptAllowed(");
    const build = route.indexOf("buildStudioAiArtPrompt(");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(build);
  });

  it("answers with its own code so the panel can show the reason", () => {
    expect(route).toMatch(/StudioAiGuardError[\s\S]{0,200}status: 422/);
  });
});

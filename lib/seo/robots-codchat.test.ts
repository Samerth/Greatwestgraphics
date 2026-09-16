import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const robots = readFileSync(resolve(process.cwd(), "app/robots.ts"), "utf8");
const source = robots.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Staging is closed to search until the WordPress cutover, and that blanket
 * `Disallow: /` also blocked CodChat's knowledge importer - so the assistant
 * could only ever be taught from the old WordPress site. That is the root
 * cause of the 15 Sep findings (it offered drop shipping, and did not know
 * the published hours, free-shipping threshold or file types).
 *
 * CodChat's crawler is `CodChatKnowledgeBot/1.0` and its robots matcher picks
 * the most specific user-agent group whose token the crawler string contains,
 * so a named group admits it without admitting anything else.
 */
describe("robots.txt while the site is closed to search", () => {
  it("still refuses every search engine", () => {
    expect(source).toMatch(/userAgent: "\*", disallow: "\/"/);
  });

  it("admits CodChat's knowledge crawler by name", () => {
    expect(source).toMatch(/userAgent: "CodChatKnowledgeBot", allow: "\/"/);
  });

  it("puts the named group before the blanket one, as robots files are read", () => {
    const named = source.indexOf('userAgent: "CodChatKnowledgeBot"');
    const blanket = source.indexOf('userAgent: "*", disallow: "/"');
    expect(named).toBeGreaterThan(-1);
    expect(blanket).toBeGreaterThan(named);
  });

  it("admits it only in the closed branch — the open site needs no exception", () => {
    // Once SEO_ALLOW_INDEX is on, the `*` group already allows everything.
    const closed = source.slice(0, source.indexOf("sitemap:"));
    expect((closed.match(/CodChatKnowledgeBot/g) ?? []).length).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  descriptionLength,
  parseVendorDescription,
} from "../vendor-description";

describe("parseVendorDescription", () => {
  it("turns a real S&S description into bullets and paragraphs", () => {
    // Verbatim from a live product page, where it rendered as visible tags.
    const html =
      '<ul><li>4.1&nbsp;<span style="text-align: left;">oz./yd² (US), 6.8 oz./L yd (CA),</span>' +
      '<span style="text-align: left;"> 65/35 recycled polyester/cotton</span></li>' +
      '<li><span style="text-align: left;">Regular fit</span></li>' +
      '<li><span style="text-align: left;">Ribbed collar</span></li>' +
      '<li><span style="text-align: left;">Contrast logo on left sleeve</span></li></ul>' +
      '<p><strong><span style="text-decoration: underline;">Responsible Materials:&nbsp;</span></strong>' +
      "contains 65% recycled polyester</p><p><br /> </p>";

    expect(parseVendorDescription(html)).toEqual([
      {
        kind: "bullet",
        text: "4.1 oz./yd² (US), 6.8 oz./L yd (CA), 65/35 recycled polyester/cotton",
      },
      { kind: "bullet", text: "Regular fit" },
      { kind: "bullet", text: "Ribbed collar" },
      { kind: "bullet", text: "Contrast logo on left sleeve" },
      {
        kind: "paragraph",
        text: "Responsible Materials: contains 65% recycled polyester",
      },
    ]);
  });

  it("drops empty blocks rather than rendering blank bullets", () => {
    expect(parseVendorDescription("<ul><li></li><li>Real</li></ul>")).toEqual([
      { kind: "bullet", text: "Real" },
    ]);
  });

  it("treats an unmarked description as a single paragraph", () => {
    expect(parseVendorDescription("Plain vendor text, no markup")).toEqual([
      { kind: "paragraph", text: "Plain vendor text, no markup" },
    ]);
  });

  it("never emits markup, so vendor script cannot reach the page", () => {
    const blocks = parseVendorDescription(
      '<p>Safe<script>alert("xss")</script></p><img src=x onerror=alert(1)>',
    );
    const joined = blocks.map((b) => b.text).join(" ");
    expect(joined).not.toContain("<");
    expect(joined).not.toContain("alert");
    expect(joined).toContain("Safe");
  });

  it("decodes numeric and named entities", () => {
    expect(parseVendorDescription("<p>50&#37; off &amp; more &#x2014; now</p>")).toEqual(
      [{ kind: "paragraph", text: "50% off & more — now" }],
    );
  });

  it("leaves an unknown entity alone instead of mangling it", () => {
    expect(parseVendorDescription("<p>&notarealentity;</p>")).toEqual([
      { kind: "paragraph", text: "&notarealentity;" },
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseVendorDescription(null)).toEqual([]);
    expect(parseVendorDescription("   ")).toEqual([]);
    expect(parseVendorDescription("<p> </p>")).toEqual([]);
  });

  it("measures visible length, not markup length", () => {
    const blocks = parseVendorDescription("<ul><li>abc</li><li>de</li></ul>");
    expect(descriptionLength(blocks)).toBe(5);
  });
});

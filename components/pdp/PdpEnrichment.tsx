"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/Container";

/** Facts that are true of every job we take, regardless of the blank. Anything
 * garment-specific has to come from the vendor record instead — see
 * `PdpEnrichmentSections`. */
const TRUST = [
  {
    title: "Proof before print",
    body: "Every order proofed, no surprises",
  },
  {
    title: "Reprint guarantee",
    body: "We reprint our mistakes, free",
  },
  {
    title: "Quick Order 48-hour available",
    body: "When the deadline is real",
  },
  {
    title: "Vancouver made since 1980",
    body: "Local production, no offshoring",
  },
];

const ARTWORK_FAQ = [
  {
    title: "Accepted files",
    body: "AI, EPS, PDF, SVG, or PNG. Vector art prints sharpest.",
  },
  {
    title: "Resolution",
    body: "300 DPI at final print size for any raster artwork.",
  },
  {
    title: "Colour matching",
    body: "Send Pantone or CMYK values and we match every run.",
  },
  {
    title: "No print-ready file?",
    body: "Ask CodChat — our team turns rough ideas into proof-ready art before anything goes to press.",
  },
];

export function PdpFeatureBullets({ description }: { description?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim();
  if (!text) return null;

  const isLong = text.length > 260;
  return (
    <div className="mt-sp-4">
      <p className="m-0 text-sm text-text-secondary">
        {isLong && !expanded ? `${text.slice(0, 260).trimEnd()}…` : text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-bold text-accent hover:underline"
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

export function PdpTrustChecks() {
  return (
    <ul className="mt-sp-3 mb-0 space-y-1.5 text-sm text-text-secondary list-none p-0">
      {["Proof before print", "Reprint guarantee", "Local Vancouver production"].map(
        (label) => (
          <li key={label} className="flex items-start gap-2">
            <span className="text-accent font-bold" aria-hidden>
              ✓
            </span>
            <span>{label}</span>
          </li>
        ),
      )}
    </ul>
  );
}

/** Out-of-stock colourways used to offer a "notify me" button that only
 * flipped local state — nothing was ever recorded, so nobody was ever
 * notified. Until there is a back-in-stock subscription to write to, point
 * the shopper at the two routes that do reach a human. */
export function PdpOutOfStockBanner({
  colorName,
  sizeLabel,
}: {
  colorName?: string;
  sizeLabel?: string;
}) {
  return (
    <div className="mt-sp-4 rounded-md border border-amber-300 bg-amber-50 p-sp-3">
      <p className="m-0 text-sm font-bold text-amber-950">
        {colorName
          ? `Color: ${colorName} — Currently Unavailable`
          : "Currently unavailable"}
      </p>
      {sizeLabel ? (
        <p className="m-0 mt-1 text-sm text-amber-900">
          Size: {sizeLabel} — Out of Stock
        </p>
      ) : null}
      <p className="m-0 mt-1 text-sm text-amber-900">
        We can often source this colourway directly, or suggest the closest
        equivalent that is in stock.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/quote"
          className="rounded-md border border-amber-800 bg-amber-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-950 transition-colors"
        >
          Ask us to source it
        </Link>
        <Link
          href="/contact"
          className="rounded-md border border-amber-800 px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-100 transition-colors"
        >
          Contact the team
        </Link>
      </div>
    </div>
  );
}

export type PdpSpec = { label: string; value: string };

/**
 * Everything shown here is either a vendor fact for this exact style or a
 * standing GWG service commitment. The section previously shipped a fixed
 * 6.5oz cotton crewneck spec sheet plus six invented customer reviews and a
 * 4.8/5 aggregate, all rendered identically on caps, totes and banners; that
 * content is gone rather than rewritten, because we have no per-product
 * review data to replace it with.
 */
export function PdpEnrichmentSections({
  brandName,
  styleName,
  styleTitle,
  partNumber,
  sizeRange,
  colourCount,
  description,
}: {
  brandName?: string;
  styleName?: string;
  styleTitle?: string | null;
  partNumber?: string | null;
  sizeRange?: string;
  colourCount?: number;
  description?: string | null;
}) {
  const specs: PdpSpec[] = [];
  if (brandName) specs.push({ label: "Brand", value: brandName });
  if (styleName) specs.push({ label: "Style", value: styleName });
  if (partNumber) specs.push({ label: "Style number", value: partNumber });
  if (styleTitle && styleTitle !== styleName) {
    specs.push({ label: "Manufacturer name", value: styleTitle });
  }
  if (sizeRange) specs.push({ label: "Sizing", value: sizeRange });
  if (colourCount && colourCount > 1) {
    specs.push({ label: "Colourways", value: `${colourCount} available` });
  }
  specs.push({
    label: "Decoration",
    value: "Screen print, DTF, embroidery, sublimation",
  });
  specs.push({
    label: "Turnaround",
    value: "Standard 7–10 business days · 48-hour Quick Order available",
  });

  return (
    <>
      <section className="py-sp-8 border-t border-border">
        <Container>
          <h2 className="font-display font-bold text-header m-0">
            Product Specifications
          </h2>
          {description ? (
            <p className="text-text-secondary mt-sp-3 mb-0 max-w-[80ch]">
              {description}
            </p>
          ) : null}
          <div className="mt-sp-4 border border-border rounded-md overflow-hidden">
            {specs.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 px-4 py-2.5 text-sm ${
                  index % 2 === 0 ? "bg-bg-raised" : "bg-bg"
                } ${index > 0 ? "border-t border-border" : ""}`}
              >
                <span className="font-bold text-text-primary">{row.label}</span>
                <span className="text-text-secondary">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-sp-3 mb-0">
            Fabric weight, fit and care details come straight from the
            manufacturer&apos;s spec sheet — ask us if you need a detail that
            isn&apos;t listed here.
          </p>
        </Container>
      </section>

      <section className="py-sp-5 border-b border-border">
        <Container>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sp-4">
            {TRUST.map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="text-accent font-bold text-lg" aria-hidden>
                  ✓
                </span>
                <div>
                  <p className="m-0 font-bold text-sm">{item.title}</p>
                  <p className="m-0 mt-0.5 text-sm text-text-secondary">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <h2 className="font-display font-bold text-header m-0">
            Artwork &amp; file requirements
          </h2>
          <div className="mt-sp-5 grid grid-cols-1 md:grid-cols-2 gap-sp-3">
            {ARTWORK_FAQ.map((item) => (
              <div
                key={item.title}
                className="rounded-md border border-border bg-bg-raised p-sp-4"
              >
                <h3 className="font-display font-bold text-base m-0">{item.title}</h3>
                <p className="text-sm text-text-secondary mt-2 mb-0">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-sp-4 mb-0">
            <Link href="/design" className="text-sm font-bold text-accent hover:underline">
              Open Design Studio →
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}

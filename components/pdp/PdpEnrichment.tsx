"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/Container";

const SPEC_ROWS: Array<{ label: string; value: string }> = [
  { label: "Type", value: "Crewneck T-Shirt" },
  { label: "Material", value: "100% combed ring-spun cotton, 6.5oz" },
  {
    label: "Highlighted Features",
    value: "Reinforced seams, pre-shrunk, tear-away tag option",
  },
  {
    label: "Turnaround",
    value: "Standard 7–10 business days · 3-Day Quick Order available",
  },
  { label: "Print Method", value: "Screen Print, DTF, Embroidery" },
  { label: "Sizing", value: "S – 3XL, true to size" },
  {
    label: "Product Features",
    value: "Colorfast print, machine washable, double-needle hem",
  },
  { label: "Weight", value: "6.5 oz/yd²" },
  { label: "Style", value: "Classic fit, crew neckline" },
  { label: "Fit", value: "Regular / true to size" },
  { label: "Neckline", value: "Ribbed crew neckline" },
  { label: "Pockets", value: "None" },
  {
    label: "Garment Tag",
    value: "Tear-away, relabel-ready for private label",
  },
  { label: "Sleeve Cuffs", value: "Ribbed knit cuffs" },
  { label: "Hem", value: "Double-needle stitched hem" },
];

const DUMMY_REVIEWS = [
  {
    stars: 5,
    body: "Print held up through a full season of staff laundry — sharp edges, no cracking.",
    name: "Maya R.",
  },
  {
    stars: 5,
    body: "Quoted Friday, proofed Monday, delivered mid-week. Exactly the turnaround we needed.",
    name: "Jordan T.",
  },
  {
    stars: 5,
    body: "Third reorder this year. Colour match stays consistent every run.",
    name: "Priya S.",
  },
  {
    stars: 4,
    body: "Solid blank and clean embroidery. Studio team flagged a file issue before press.",
    name: "Chris L.",
  },
  {
    stars: 5,
    body: "Team kits looked pro on day one. Sizing ran true across XS–3XL.",
    name: "Alex M.",
  },
  {
    stars: 5,
    body: "Easy to reorder from the portal once the proof was locked.",
    name: "Sam K.",
  },
];

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

const FEATURE_BULLETS = [
  "Made from 100% combed ring-spun cotton",
  "Weighs 6.5oz, reinforced seams",
  "Classic fit, true to size",
  "Tear-away tag ready for private label",
];

const PAGE_SIZE = 3;
const TOTAL_REVIEWS = 214;

export function PdpFeatureBullets() {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? FEATURE_BULLETS : FEATURE_BULLETS.slice(0, 3);
  return (
    <div className="mt-sp-4">
      <ul className="m-0 pl-4 space-y-1.5 text-sm text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="mt-2 text-sm font-bold text-accent hover:underline"
      >
        {showAll ? "Show less" : "Show all"}
      </button>
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

export function PdpOutOfStockBanner({
  colorName,
  sizeLabel,
}: {
  colorName?: string;
  sizeLabel?: string;
}) {
  const [notified, setNotified] = useState(false);
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
      <button
        type="button"
        onClick={() => setNotified(true)}
        disabled={notified}
        className="mt-3 w-full rounded-md border border-amber-800 bg-amber-900 text-white font-bold text-sm py-3 px-4 disabled:opacity-70"
      >
        {notified ? "We'll notify you" : "Notify Me When Back in Stock"}
      </button>
    </div>
  );
}

export function PdpEnrichmentSections({
  brandName,
  styleName,
  sizeRange,
}: {
  brandName?: string;
  styleName?: string;
  sizeRange?: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(DUMMY_REVIEWS.length / PAGE_SIZE);
  const visible = useMemo(
    () => DUMMY_REVIEWS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [page],
  );

  const specs = SPEC_ROWS.map((row) => {
    if (row.label === "Type" && styleName) {
      return { ...row, value: styleName };
    }
    if (row.label === "Sizing" && sizeRange) {
      return { ...row, value: `${sizeRange}, true to size` };
    }
    if (row.label === "Style" && brandName) {
      return { ...row, value: `${brandName} · classic fit` };
    }
    return row;
  });

  return (
    <>
      <section className="py-sp-8 border-t border-border">
        <Container>
          <h2 className="font-display font-bold text-header m-0">
            Product Specifications
          </h2>
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
        </Container>
      </section>

      <section className="py-sp-8 bg-bg-raised border-y border-border">
        <Container>
          <h2 className="font-display font-bold text-header m-0 text-center">
            What Buyers Are Saying
          </h2>
          <div className="mt-sp-5 grid grid-cols-1 md:grid-cols-3 gap-sp-3">
            {visible.map((review) => (
              <article
                key={`${review.name}-${review.body.slice(0, 24)}`}
                className="rounded-md border border-border bg-bg p-sp-4"
              >
                <p className="m-0 text-accent tracking-widest" aria-label={`${review.stars} stars`}>
                  {"★".repeat(review.stars)}
                </p>
                <p className="mt-3 mb-0 text-sm text-text-secondary">{review.body}</p>
                <p className="mt-3 mb-0 text-sm font-bold">{review.name}</p>
              </article>
            ))}
          </div>
          <div className="mt-sp-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-sm border border-border px-3 py-1.5 text-sm font-bold disabled:opacity-40"
            >
              ‹ Prev
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`min-w-8 rounded-sm border px-2.5 py-1.5 text-sm font-bold ${
                  i === page
                    ? "border-accent bg-accent text-white"
                    : "border-border"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-sm border border-border px-3 py-1.5 text-sm font-bold disabled:opacity-40"
            >
              Next ›
            </button>
            <span className="text-xs text-text-tertiary ml-2">
              Showing {visible.length} of {TOTAL_REVIEWS} reviews
            </span>
          </div>
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
        </Container>
      </section>

      <section className="py-sp-8 bg-bg-raised border-y border-border">
        <Container>
          <h2 className="font-display font-bold text-header m-0 text-center">
            Print Quality, Rated by Buyers
          </h2>
          <div className="mt-sp-5 grid grid-cols-1 sm:grid-cols-3 gap-sp-4 max-w-3xl mx-auto text-center">
            {[
              { score: "4.8/5", label: "Durability" },
              { score: "4.9/5", label: "Color Accuracy" },
              { score: "4.7/5", label: "Print Sharpness" },
            ].map((item) => (
              <div key={item.label}>
                <p className="m-0 text-accent text-xl" aria-hidden>
                  ★
                </p>
                <p className="m-0 mt-2 font-display font-bold text-2xl">{item.score}</p>
                <p className="m-0 mt-1 text-sm text-text-secondary">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-sp-4 mb-0">
            <Link href="/design" className="text-sm font-bold text-accent hover:underline">
              Open Design Studio →
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}

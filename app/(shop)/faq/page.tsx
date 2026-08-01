import type { Metadata } from "next";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Shipping, drop shipping, merchandise stores, colour matching, artwork file types and more — answers from the Great West Graphics production floor.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "Do you offer free shipping?",
    a: "Yes — orders over $300 ship free anywhere in Canada and the United States.",
  },
  {
    q: "Where can you ship to?",
    a: "Anywhere in Canada and the United States.",
  },
  {
    q: "What are your hours of operation?",
    a: "8:30am–4:30pm PST, Monday to Friday.",
  },
  {
    q: "Can I organize a carrier to pick up my package?",
    a: "Yes — contact our office and we'll arrange the pickup details with you.",
  },
  {
    q: "Do you do drop shipping?",
    a: "Yes, including blind shipping on a third party's behalf.",
  },
  {
    q: "Can I create a merchandise store?",
    a: "Yes — we can set up a branded store for your team or organization. Contact our office and we'll walk you through it.",
  },
  {
    q: "How does a merchandise store work?",
    a: "Your store displays a selected set of products your people can order from. We run bulk printing, not one-off print-on-demand, so stores work best with a curated product list rather than an unlimited catalogue.",
  },
  {
    q: "How many products can I add to a merchandise store?",
    a: "There's no hard limit, but we recommend keeping the selection tight — fewer options means faster turnaround and better volume pricing per item.",
  },
  {
    q: "What's the difference between a vectorized and a rasterized file?",
    a: "Rasterized images (JPG, PNG) are made of pixels and lose quality when scaled up. Vectorized images (AI, EPS, SVG) are made of paths and can be scaled to any size without losing quality — that's what we need for the cleanest print and embroidery results.",
  },
  {
    q: "Do you do colour matching?",
    a: "Yes — we can match any colour using the Pantone Matching System, with 37 stock ink colours on hand.",
  },
  {
    q: "Do you offer discounts?",
    a: "Yes, for certain businesses and not-for-profit organizations — ask when you request a quote.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="py-sp-8 border-b border-border">
        <Container>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Frequently asked questions
          </span>
          <h1 className="font-display font-bold text-display leading-display mt-sp-2 max-w-[18ch]">
            Answers from the print floor.
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[60ch]">
            Can&apos;t find what you&apos;re looking for?{" "}
            <a href="/contact" className="font-bold text-accent hover:underline">
              Send us a message
            </a>{" "}
            and a specialist will get back to you.
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container className="max-w-[860px]">
          <dl className="divide-y divide-border border-t border-b border-border">
            {FAQS.map((item) => (
              <div key={item.q} className="py-sp-4">
                <dt className="font-display font-bold text-lg">{item.q}</dt>
                <dd className="text-text-secondary mt-sp-2">{item.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-sp-7 rounded-lg bg-accent text-white p-sp-5 flex flex-wrap items-center justify-between gap-sp-3">
            <div>
              <h2 className="font-display text-header font-bold">Still have questions?</h2>
              <p className="mt-sp-1 text-white/80">
                Tell us what you&apos;re making and we&apos;ll help you plan it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/quote" className="bg-white !text-text-primary hover:!bg-white/90">
                Request a quote
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" className="!border-white/40 !text-white hover:!bg-white/10">
                Contact the team
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

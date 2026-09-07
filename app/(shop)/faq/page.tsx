import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Ordering, artwork, print methods, shipping and account support — answers from the Great West Graphics production floor.",
  alternates: { canonical: "/faqs" },
};

const FAQ_CATEGORIES: Array<{
  title: string;
  items: Array<{ q: string; a: string }>;
}> = [
  {
    title: "Ordering & Pricing",
    items: [
      {
        q: "How is my price determined?",
        a: "Price is based on garment, print method, quantity, ink colours, and placements — pricing drops automatically at 50, 100 and 250+ units.",
      },
      {
        q: "What is the minimum order quantity?",
        a: "Most runs start at 24 units. Smaller runs may be possible for embroidery — ask your rep.",
      },
      {
        q: "What are my payment options?",
        a: "Credit card, e-transfer, or Net-30 terms for approved accounts. A 50% deposit is required on custom orders.",
      },
    ],
  },
  {
    title: "Design & Artwork",
    items: [
      {
        q: "What file types do you accept?",
        a: "AI, EPS, PDF, or high-resolution PNG (300 DPI minimum). Not print-ready? Our team can vectorize your logo.",
      },
      {
        q: "Can I get a sample before I order?",
        a: "Yes — request a free digital proof before you commit to a full run. We review artwork and send a mockup for sign-off.",
      },
      {
        q: "Do you do colour matching?",
        a: "Yes — we match any colour using the Pantone Matching System, with 37 stock ink colours on hand.",
      },
    ],
  },
  {
    title: "Printing Options & Processes",
    items: [
      {
        q: "What print methods do you offer?",
        a: "Screen printing, embroidery, DTF, and sublimation — matched to your garment, design, and quantity.",
      },
      {
        q: "Which method is right for my order?",
        a: "Screen printing suits bulk runs with few colours; DTF handles full-colour art on any fabric; embroidery suits logos on structured garments.",
      },
      {
        q: "Is every order proofed before print?",
        a: "Yes — every order gets a digital proof for sign-off before it goes to press.",
      },
    ],
  },
  {
    title: "Shipping & Delivery",
    items: [
      {
        q: "Do you offer free shipping?",
        a: "Yes — orders over $300 ship free anywhere in Canada and the United States.",
      },
      {
        q: "Where can you ship to?",
        a: "Anywhere in Canada and the United States.",
      },
      {
        q: "How fast is turnaround?",
        a: "Standard turnaround is 7–10 business days. Quick Order 48-hour turnaround is available for an added fee.",
      },
    ],
  },
  {
    title: "Account & Support",
    items: [
      {
        q: "What are your hours of operation?",
        a: "8:30am to 4:30pm PST, Monday to Friday.",
      },
      {
        q: "What if I have a problem with my order?",
        a: "Contact our team directly — every order is proofed and tracked, so we can resolve issues quickly.",
      },
      {
        q: "Can I reorder a past design?",
        a: "Yes — we keep your artwork and specs on file, so reorders are quick with no new setup fee.",
      },
      {
        // Restates the reprint guarantee the rest of the site already makes
        // ("We reprint our mistakes, free"), so it is publishable as-is. It
        // previously rendered under a visible "Policy language pending GWG
        // confirmation" note, which told every visitor the shop had not
        // settled its own returns policy.
        q: "What if my order arrives misprinted or damaged?",
        a: "If your order arrives misprinted, mismatched, or damaged, contact our team with photos and your order number. Once reviewed, we’ll arrange a reprint or refund per our quality guarantee.",
      },
    ],
  },
];

export default function FaqPage() {
  const flat = FAQ_CATEGORIES.flatMap((c) => c.items);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: flat.map((item) => ({
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
      <section className="py-sp-6 border-b border-border">
        <Container>
          <p className="text-sm text-text-tertiary m-0">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>{" "}
            / FAQ
          </p>
          {/* Was `text-header` (the small heading token), so the page title
              read as a sub-heading rather than the top of a page. */}
          <h1 className="font-display font-bold text-display leading-display mt-sp-3 m-0">
            Frequently Asked Questions
          </h1>
          <p className="text-text-secondary mt-sp-3 mb-0 max-w-[60ch]">
            Ordering, artwork, print methods and shipping — answered from the
            production floor. Can&apos;t find it here?{" "}
            <Link href="/contact" className="text-accent font-semibold hover:underline">
              Ask us directly
            </Link>
            .
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container className="space-y-sp-7">
          {/* Answers stay visible rather than collapsing into an accordion:
              there are only twelve of them, they are short, and hiding them
              behind a click would make the page slower to scan, not faster.
              What was missing was hierarchy — categories now read as
              categories, and each question sits in its own card instead of
              running together as one wall of text. */}
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.title}>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent mb-sp-3">
                <span className="w-4 h-0.5 bg-accent" />
                {category.title}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-sp-3">
                {category.items.map((item) => (
                  <div
                    key={item.q}
                    className="rounded-lg border border-border bg-bg-raised p-sp-4 transition-[border-color,box-shadow] duration-med ease-out-custom hover:border-text-tertiary hover:shadow-card"
                  >
                    <h3 className="font-display font-bold text-[15.5px] m-0">
                      {item.q}
                    </h3>
                    <p className="text-sm text-text-secondary mt-2 mb-0 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Container>
      </section>

      <section className="py-sp-8 bg-bg-raised border-t border-border text-center">
        <Container>
          <h2 className="font-display font-bold text-header m-0">
            Still have questions?
          </h2>
          <p className="text-text-secondary mt-sp-2 mb-sp-4">
            Tell us what you&apos;re making and we&apos;ll help you plan it.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
              <ButtonLink href="/quote">Request a Quote</ButtonLink>
            ) : null}
            <ButtonLink href="/contact" variant="secondary">
              Contact the Team
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

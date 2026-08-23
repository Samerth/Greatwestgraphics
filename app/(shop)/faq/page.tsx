import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Ordering, artwork, print methods, shipping and account support — answers from the Great West Graphics production floor.",
  alternates: { canonical: "/faq" },
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
          <h1 className="font-display font-bold text-header mt-sp-4 m-0">
            Frequently Asked Questions
          </h1>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container className="space-y-sp-7">
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h2 className="font-display font-bold text-lg m-0 mb-sp-4">
                {category.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-sp-4 gap-y-sp-4">
                {category.items.map((item) => (
                  <div key={item.q}>
                    <h3 className="font-bold text-[15px] m-0">{item.q}</h3>
                    <p className="text-sm text-text-secondary mt-2 mb-0">
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
            <ButtonLink href="/quote">Request a Quote</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact the Team
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

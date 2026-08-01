import type { Metadata } from "next";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Great West Graphics has been screen printing and embroidering in Vancouver since 1980 — custom apparel, promotional products and signage, proofed before every print run.",
  alternates: { canonical: "/about" },
};

const TIMELINE = [
  {
    year: "1980",
    title: "Founded in Vancouver",
    body: "Two experienced printers started Great West Graphics as a custom screen printing and embroidery shop, bringing their trade expertise to the local community.",
  },
  {
    year: "1990",
    title: "Long-term client relationships begin",
    body: "Some of our customer relationships from this era are still active today — a track record of reliability, not just a claim.",
  },
  {
    year: "2020",
    title: "30+ years of combined experience",
    body: "The team behind the presses and embroidery machines has accumulated three decades of hands-on decoration expertise.",
  },
  {
    year: "Today",
    title: "Serving Canada and the USA",
    body: "From our Vancouver production floor, we ship custom apparel, promo products and signage across both countries — without missing deadlines.",
  },
];

const VALUES = [
  {
    title: "Quality and passion",
    body: "We treat every job — a 12-piece staff order or a 1,200-piece event run — with the same attention to detail.",
  },
  {
    title: "Stress-free from the start",
    body: "We guide you through design choices, decoration method and product selection at every step, not just at checkout.",
  },
  {
    title: "We specialize in rush orders",
    body: "Deadlines don't move. When production has to be fast, it's still proofed and checked before it ships.",
  },
  {
    title: "Real colour matching",
    body: "37 stock ink colours on hand, plus full Pantone Matching System support for exact brand colours.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="py-sp-8 border-b border-border">
        <Container>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Since 1980
          </span>
          <h1 className="font-display font-bold text-display leading-display mt-sp-2 max-w-[18ch]">
            46 years on the print floor.
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[64ch]">
            Great West Graphics started as a screen printing and embroidery
            partnership in Vancouver in 1980. We&apos;re still here, still
            proofing every job before it prints, and still run by people who
            know the difference between a good print and a great one.
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <h2 className="font-display text-header font-bold mb-sp-5">Our story</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-sp-3">
            {TIMELINE.map((item) => (
              <article key={item.year} className="rounded-lg border border-border bg-bg-raised p-sp-4">
                <span className="text-xs font-bold text-accent">{item.year}</span>
                <h3 className="font-display text-lg font-bold mt-sp-2">{item.title}</h3>
                <p className="text-sm text-text-secondary mt-sp-2">{item.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-sp-8 bg-bg-raised border-y border-border">
        <Container>
          <h2 className="font-display text-header font-bold mb-sp-5">What we stand for</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-sp-4">
            {VALUES.map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-lg font-bold">{item.title}</h3>
                <p className="text-text-secondary mt-sp-1.5">{item.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <h2 className="font-display text-header font-bold mb-sp-2">
            Trusted by teams across Canada and the USA
          </h2>
          <p className="text-text-secondary mb-sp-5">
            Including Marriott, St. George&apos;s School, Fujitsu and Grande West.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3 mb-sp-6">
            <blockquote className="rounded-lg border border-border bg-bg-raised p-sp-4">
              <p className="text-sm">&ldquo;Good fast turnover and good quality product.&rdquo;</p>
              <footer className="text-xs text-text-tertiary mt-sp-2">— Nabil Khan</footer>
            </blockquote>
            <blockquote className="rounded-lg border border-border bg-bg-raised p-sp-4">
              <p className="text-sm">
                &ldquo;Good quality of work, better service, and the main thing is
                they deliver in the given time period.&rdquo;
              </p>
              <footer className="text-xs text-text-tertiary mt-sp-2">— Singh Saini</footer>
            </blockquote>
            <blockquote className="rounded-lg border border-border bg-bg-raised p-sp-4">
              <p className="text-sm">
                &ldquo;Great customer service, ordered custom merchandise with no
                hassle, and received quickly.&rdquo;
              </p>
              <footer className="text-xs text-text-tertiary mt-sp-2">— Ahuja</footer>
            </blockquote>
          </div>

          <div className="rounded-lg bg-accent text-white p-sp-5 flex flex-wrap items-center justify-between gap-sp-3">
            <div>
              <h2 className="font-display text-header font-bold">Ready to start your project?</h2>
              <p className="mt-sp-1 text-white/80">
                Share the product, quantity and deadline — we&apos;ll take it from there.
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

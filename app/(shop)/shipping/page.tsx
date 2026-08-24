import type { Metadata } from "next";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

export const metadata: Metadata = {
  title: "Shipping & Delivery",
  description:
    "Pickup in Vancouver, Metro Vancouver courier, and tracked shipping across Canada and the United States.",
  alternates: { canonical: "/shipping-delivery" },
};

const DELIVERY_OPTIONS = [
  {
    title: "Local pickup",
    timing: "Ready when production is complete",
    detail: "Collect from our Vancouver production studio. We will confirm the pickup window after proof approval.",
  },
  {
    title: "Metro Vancouver delivery",
    timing: "Usually next business day",
    detail: "Courier delivery across Vancouver, Burnaby, Richmond, North Vancouver and nearby municipalities.",
  },
  {
    title: "Canada-wide shipping",
    timing: "2–7 business days in transit",
    detail: "Tracked ground or priority shipping. Final timing depends on destination, carton count and carrier capacity.",
  },
];

export default function ShippingPage() {
  return (
    <>
      <section className="py-sp-8 border-b border-border">
        <Container>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Delivery & pickup
          </span>
          <h1 className="font-display font-bold text-display leading-display mt-sp-2 max-w-[15ch]">
            From our floor to your door.
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[64ch]">
            Every order is packed, counted and checked before dispatch. Delivery
            estimates begin after artwork approval and production—not when the quote is created.
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3">
            {DELIVERY_OPTIONS.map((option, index) => (
              <article key={option.title} className="rounded-lg border border-border bg-bg-raised p-sp-4">
                <span className="text-xs font-bold text-accent">0{index + 1}</span>
                <h2 className="font-display text-xl font-bold mt-sp-2">{option.title}</h2>
                <p className="text-sm font-bold mt-sp-2">{option.timing}</p>
                <p className="text-sm text-text-secondary mt-sp-2">{option.detail}</p>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-sp-5 mt-sp-7">
            <div>
              <h2 className="font-display text-header font-bold">Before your order ships</h2>
              <ul className="mt-sp-3 space-y-sp-2 text-text-secondary">
                <li>• You approve the digital artwork proof.</li>
                <li>• Production confirms quantities, decoration and finishing.</li>
                <li>• Cartons are counted and quality checked.</li>
                <li>• Tracking or pickup details are issued when ready.</li>
              </ul>
            </div>
            <div className="rounded-lg bg-accent text-white p-sp-5">
              <h2 className="font-display text-header font-bold">Working toward a deadline?</h2>
              <p className="mt-sp-2 text-white/80">
                Include your required in-hands date when requesting a quote. We will
                confirm production and freight timing before you approve.
              </p>
              <div className="mt-sp-4 flex flex-wrap gap-2">
                {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
                  <ButtonLink href="/quote" className="bg-white !text-text-primary hover:!bg-white/90">
                    Request a quote
                  </ButtonLink>
                ) : null}
                <ButtonLink href="/contact" variant="secondary" className="!border-white/40 !text-white hover:!bg-white/10">
                  Contact the team
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

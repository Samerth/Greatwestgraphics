import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { publicPrintMethodHref, publicQuoteOrFallback } from "@/lib/features";

const METHODS = [
  {
    title: "Embroidery",
    body: "Stitched, durable, premium finish for logos and text.",
    href: publicPrintMethodHref("embroidery"),
    image: "/images/shop-embroidery.jpg",
  },
  {
    title: "Screen Printing",
    body: "Long-lasting quality, favoured for bulk apparel runs.",
    href: publicPrintMethodHref("screen"),
    image: "/images/shop-ink.jpg",
  },
  {
    title: "Direct to Film (DTF)",
    body: "Versatile, high-quality prints on nearly any fabric.",
    href: publicPrintMethodHref("dtf"),
    image: "/images/direct-to-film-card.jpg",

  },
  {
    title: "Sublimation Printing",
    body: "All-over, full-colour prints for jerseys and uniforms.",
    href: publicPrintMethodHref("sublimation"),
    image: "/images/printing_2.jpg",
  },
];

export function PrintMethods() {
  return (
    <section className="section-pad bg-bg-raised border-y border-border">
      <Container>
        <h2 className="font-display font-bold text-header leading-header m-0 text-balance">
          Print Methods
        </h2>
        <p className="text-text-secondary mt-sp-2 mb-0 text-sm sm:text-base">
          Whatever the job calls for, we run it in-house.
        </p>
        <div className="mt-sp-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sp-3">
          {METHODS.map((method, index) => (
            <Link
              key={method.title}
              href={method.href}
              className="group block rounded-md overflow-hidden border border-border bg-bg hover:border-accent transition-colors"
            >
              <div className="relative aspect-[260/200] sm:aspect-[260/250] opacity-95">
                <Image
                  src={method.image}
                  alt=""
                  fill
                  priority={index === 0}
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <div className="p-sp-3 text-center">
                <h3 className="font-display font-bold text-base m-0 text-text-primary group-hover:text-accent transition-colors">
                  {method.title}
                </h3>
                <p className="text-sm text-text-secondary mt-2 mb-0 leading-relaxed">
                  {method.body}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

const ORDER_STEPS = [
  {
    num: "01",
    title: "Tell us what you need",
    body: "Send us the garment, the quantity and your deadline — or start from a price in the quote builder.",
    cta: { label: "Start a quote", href: "/quote" },
  },
  {
    num: "02",
    title: "Send artwork, or make it here",
    body: "Upload a logo or build something from scratch in the design studio. We clean up the file either way.",
    cta: { label: "Open design studio", href: "/design" },
  },
  {
    num: "03",
    title: "Approve your proof",
    body: "A free digital proof lands in your inbox with colours, placement and sizing before anything runs.",
    cta: { label: "How proofing works", href: "/faq" },
  },
  {
    num: "04",
    title: "We print and deliver",
    body: "Printed in-house in Vancouver, counted twice, then picked up locally or couriered Canada-wide.",
    cta: { label: "Shipping & delivery", href: "/shipping" },
  },
];

/**
 * Replaces the old "What We Do" service list, which repeated the print
 * methods grid directly above it. The two links that list carried — the
 * services hub and the locations hub — are kept in the footer of this
 * section, so nothing that pointed at them is lost.
 */
export function HowToOrder() {
  return (
    <section className="section-pad bg-bg-raised border-y border-border">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-sp-3">
          <div className="max-w-[46ch]">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
              How to order
            </p>
            <h2 className="font-display font-bold text-header leading-header m-0 text-balance">
              Four steps from idea to delivery
            </h2>
          </div>
          <p className="text-text-secondary m-0 max-w-[38ch] text-sm sm:text-base">
            No account needed to get started, and a real person on every job.
          </p>
        </div>

        <ol className="mt-sp-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sp-3 list-none p-0 m-0">
          {ORDER_STEPS.map((step, index) => (
            <li key={step.num} className="relative h-full">
              {index < ORDER_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="hidden lg:block absolute top-[26px] left-[calc(100%+0.25rem)] right-[-1.25rem] h-px bg-border"
                />
              )}
              <div className="h-full rounded-md border border-border bg-bg p-sp-4 flex flex-col hover:border-accent transition-colors">
                <span className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent-tint font-display font-bold text-accent text-lg">
                  {step.num}
                </span>
                <h3 className="mt-sp-3 mb-1.5 font-display font-bold text-base m-0 text-text-primary">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary m-0 leading-relaxed">
                  {step.body}
                </p>
                <Link
                  href={step.cta.href}
                  className="mt-sp-3 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline"
                >
                  {step.cta.label}
                  <span aria-hidden>&rarr;</span>
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-sp-5 flex flex-wrap items-center justify-between gap-sp-3 rounded-md border border-border bg-bg px-sp-4 py-sp-3">
          <p className="m-0 text-sm sm:text-base text-text-secondary">
            Know what you want already? Skip ahead and price it in a minute.
          </p>
          <div className="flex flex-wrap items-center gap-sp-3">
            <Link
              href="/services"
              className="text-sm font-bold text-accent hover:underline"
            >
              See all services
            </Link>
            <Link
              href="/locations"
              className="text-sm font-bold text-accent hover:underline"
            >
              Locations we serve
            </Link>
            <ButtonLink href="/quote" variant="primary">
              Start an Order
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function OrderNowBand() {
  const eta = nextBusinessWeekLabel();
  return (
    <section className="relative section-pad text-white text-center overflow-hidden">
      {/* Photo background, tinted with the brand accent rather than shown
          raw — keeps the "shipping is happening now" feel of the photo
          without losing the solid-color punch this band relied on before. */}
      <Image
        src="/images/packaged.jpg"
        alt=""
        fill
        priority={false}
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-accent/85" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.25)_0%,rgba(0,0,0,.05)_45%,rgba(0,0,0,.35)_100%)]" />

      <Container className="relative">
        <h2 className="font-display font-bold text-[clamp(1.35rem,4vw,2rem)] text-white m-0 text-balance px-1">
          Order Now and get it as fast as {eta}
        </h2>
        <p className="mt-sp-2 mb-0 text-white/90 text-sm sm:text-base leading-relaxed">
          Need it faster? Contact us for a Quick Order!
        </p>
        <div className="mt-sp-4 flex justify-center">
          <ButtonLink
            href={publicQuoteOrFallback("/products")}
            variant="secondary"
            className="!bg-white !text-accent hover:!bg-white/90 border-transparent"
          >
            Order Now!
          </ButtonLink>
        </div>
        <p className="mt-sp-4 mb-0 text-sm text-white/80">
          Free shipping for all custom product orders.
        </p>
      </Container>
    </section>
  );
}

function nextBusinessWeekLabel(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

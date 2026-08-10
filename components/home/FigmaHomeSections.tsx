import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

const METHODS = [
  {
    title: "Embroidery",
    body: "Stitched, durable, premium finish for logos and text.",
    href: "/quote?method=embroidery",
  },
  {
    title: "Screen Printing",
    body: "Long-lasting quality, favoured for bulk apparel runs.",
    href: "/quote?method=screen",
  },
  {
    title: "Direct to Film (DTF)",
    body: "Versatile, high-quality prints on nearly any fabric.",
    href: "/quote?method=dtf",
  },
  {
    title: "Sublimation Printing",
    body: "All-over, full-colour prints for jerseys and uniforms.",
    href: "/quote?method=sublimation",
  },
];

export function PrintMethods() {
  return (
    <section className="py-sp-8">
      <Container>
        <h2 className="font-display font-bold text-header leading-header m-0">
          Print Methods
        </h2>
        <p className="text-text-secondary mt-sp-2 mb-0">
          Whatever the job calls for, we run it in-house.
        </p>
        <div className="mt-sp-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sp-3">
          {METHODS.map((method) => (
            <Link
              key={method.title}
              href={method.href}
              className="group block rounded-md border border-border bg-bg-raised overflow-hidden hover:border-accent transition-colors"
            >
              <div
                className="aspect-[260/250] bg-[linear-gradient(160deg,var(--color-accent)_0%,var(--color-accent-hover)_40%,#0D0D0D_100%)] opacity-90"
                aria-hidden
              />
              <div className="p-sp-3 text-center">
                <h3 className="font-display font-bold text-base m-0 group-hover:text-accent transition-colors">
                  {method.title}
                </h3>
                <p className="text-sm text-text-secondary mt-2 mb-0">
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

const SERVICES = [
  {
    title: "Screen Printing",
    body: "Bulk apparel runs, spot & multi-color",
    lead: "5–7 business days",
  },
  {
    title: "Embroidery",
    body: "Logo digitizing included, durable finish",
    lead: "7–10 business days",
  },
  {
    title: "DTG",
    body: "Full-color, small-run friendly",
    lead: "3–5 business days",
  },
  {
    title: "Promotional Products",
    body: "Drinkware, bags, signage, and more",
    lead: "10–14 business days",
  },
];

export function ServicesBreakdown() {
  return (
    <section className="py-sp-8 bg-bg-raised border-y border-border">
      <Container>
        <h2 className="text-center font-display font-bold text-header m-0 mb-sp-5">
          What We Do
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sp-4">
          {SERVICES.map((service) => (
            <div key={service.title}>
              <h3 className="font-display font-bold text-base m-0">
                {service.title}
              </h3>
              <p className="text-sm text-text-secondary mt-2 mb-1">
                {service.body}
              </p>
              <p className="text-sm font-bold text-accent m-0">{service.lead}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function OrderNowBand() {
  const eta = nextBusinessWeekLabel();
  return (
    <section className="py-sp-7 bg-accent text-white text-center">
      <Container>
        <h2 className="font-display font-bold text-[clamp(22px,2.6vw,32px)] text-white m-0">
          Order Now and get it as fast as {eta}
        </h2>
        <p className="mt-sp-2 mb-0 text-white/85">
          Need it faster? Contact us for a Quick Order!
        </p>
        <div className="mt-sp-4 flex justify-center">
          <ButtonLink
            href="/quote"
            variant="secondary"
            className="!bg-white !text-accent hover:!bg-white/90 border-transparent"
          >
            Order Now!
          </ButtonLink>
        </div>
        <p className="mt-sp-4 mb-0 text-sm text-white/75">
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

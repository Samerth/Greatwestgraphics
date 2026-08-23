import Link from "next/link";
import { PrintMethods, ServicesBreakdown } from "@/components/home/FigmaHomeSections";
import { Gallery } from "@/components/home/StaticSections";
import { ButtonLink } from "@/components/shared/Button";
import { Container } from "@/components/shared/Container";
import type { ContentPage } from "@/lib/seo/content-pages";
import type { LocationPage } from "@/lib/seo/location-pages";
import { locationIntro, locationPlaceLabel } from "@/lib/seo/location-pages";
import { GWG_ADDRESS, GWG_EMAIL, GWG_PHONE_DISPLAY, GWG_PHONE_TEL } from "@/lib/seo/phone";
import {
  breadcrumbJsonLd,
  locationBreadcrumb,
  serviceJsonLd,
} from "@/lib/seo/schema";

type LandingPage = LocationPage | (ContentPage & { city?: string });

function isLocation(page: LandingPage): page is LocationPage {
  return "city" in page && Boolean(page.city);
}

function shopHref(page: LandingPage): string {
  return page.categorySlug
    ? `/products?category=${encodeURIComponent(page.categorySlug)}`
    : "/products";
}

function quoteHref(page: LandingPage): string {
  return page.method ? `/quote?method=${encodeURIComponent(page.method)}` : "/quote";
}

function introFor(page: LandingPage): string {
  if (isLocation(page)) return locationIntro(page);
  return page.intro ?? "";
}

export function SeoLanding({ page }: { page: LandingPage }) {
  const intro = introFor(page);
  const place = isLocation(page) ? locationPlaceLabel(page) : null;
  const jsonLd = [
    serviceJsonLd({
      h1: page.h1,
      description: page.description,
      path: page.path,
      city: isLocation(page) ? page.city : "",
      region: isLocation(page) ? page.region : "",
      country: isLocation(page) ? page.country : "CA",
      service: page.service ?? page.h1,
    }),
    isLocation(page)
      ? locationBreadcrumb(page)
      : breadcrumbJsonLd([{ name: page.h1, path: page.path }]),
  ];

  return (
    <>
      {jsonLd.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}

      <section className="py-sp-6 border-b border-border">
        <Container>
          <p className="text-sm text-text-tertiary m-0">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>
            {place ? (
              <>
                {" "}
                / <span>{place}</span>
              </>
            ) : null}{" "}
            / {page.h1}
          </p>
          <h1 className="font-display font-bold text-header mt-sp-4 m-0">
            {page.h1}
          </h1>
          {intro ? (
            <p className="text-text-secondary mt-sp-3 max-w-[64ch] mb-0">
              {intro}
            </p>
          ) : null}
          <div className="mt-sp-4 flex flex-wrap gap-2.5">
            <ButtonLink href={quoteHref(page)}>Request a Quote</ButtonLink>
            <ButtonLink href={shopHref(page)} variant="secondary">
              Shop the catalogue
            </ButtonLink>
            <ButtonLink href="/design" variant="secondary">
              Design studio
            </ButtonLink>
          </div>
        </Container>
      </section>

      {page.path === "/how-to-order" ? <HowToSteps /> : null}
      {page.path === "/gallery" ? <Gallery /> : null}
      {page.path === "/services" || page.path.startsWith("/decoration-processes") ? (
        <>
          <PrintMethods />
          <ServicesBreakdown />
        </>
      ) : (
        <PrintMethods />
      )}

      <section className="py-sp-8 bg-bg-raised border-t border-border">
        <Container className="flex flex-wrap items-end justify-between gap-sp-4">
          <div>
            <h2 className="font-display font-bold text-header m-0">
              Talk to the floor
            </h2>
            <p className="text-text-secondary mt-sp-2 mb-0 max-w-[56ch]">
              {GWG_ADDRESS}
              <br />
              <a href={`mailto:${GWG_EMAIL}`} className="text-accent font-bold">
                {GWG_EMAIL}
              </a>{" "}
              ·{" "}
              <a href={`tel:${GWG_PHONE_TEL}`} className="text-accent font-bold">
                {GWG_PHONE_DISPLAY}
              </a>
            </p>
          </div>
          <ButtonLink href="/contact" variant="secondary">
            Contact the team
          </ButtonLink>
        </Container>
      </section>
    </>
  );
}

function HowToSteps() {
  const steps = [
    { title: "Choose a garment", href: "/products", body: "Pick a live blank from the catalogue." },
    { title: "Add artwork", href: "/design", body: "Use the design studio or send a print-ready file." },
    { title: "Approve the proof", href: "/quote", body: "Nothing goes to press until you sign off." },
    { title: "We print and ship", href: "/shipping-delivery", body: "Standard production is 5–7 business days; rush is quoted against the calendar." },
  ];
  return (
    <section className="py-sp-8">
      <Container>
        <h2 className="font-display font-bold text-header m-0 mb-sp-5">
          Four steps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-sp-3">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              className="rounded-lg border border-border bg-bg-raised p-sp-4 hover:border-accent"
            >
              <span className="text-xs font-bold text-accent">0{index + 1}</span>
              <h3 className="font-display text-lg font-bold mt-sp-2">{step.title}</h3>
              <p className="text-sm text-text-secondary mt-sp-2 mb-0">{step.body}</p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

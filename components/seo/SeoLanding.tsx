import Link from "next/link";
import { PrintMethods, ServicesBreakdown } from "@/components/home/FigmaHomeSections";
import { Gallery } from "@/components/home/StaticSections";
import { ButtonLink } from "@/components/shared/Button";
import { Container } from "@/components/shared/Container";
import type { ContentPage } from "@/lib/seo/content-pages";
import { relatedLandingLinks } from "@/lib/seo/location-hub";
import {
  locationIntro,
  locationPlaceLabel,
  locationSections,
  type LocationPage,
} from "@/lib/seo/location-pages";
import {
  GWG_ADDRESS,
  GWG_EMAIL,
  GWG_PHONE_DISPLAY,
  GWG_PHONE_TEL,
} from "@/lib/seo/phone";
import {
  breadcrumbJsonLd,
  locationBreadcrumb,
  serviceJsonLd,
} from "@/lib/seo/schema";

type LandingPage = LocationPage | (ContentPage & { city?: string });

function isLocation(page: LandingPage): page is LocationPage {
  return "city" in page && Boolean(page.city) && "thin" in page;
}

function isContent(page: LandingPage): page is ContentPage {
  return "mode" in page;
}

function shopHref(page: LandingPage): string {
  return page.categorySlug
    ? `/products?category=${encodeURIComponent(page.categorySlug)}`
    : "/products";
}

function quoteHref(page: LandingPage): string {
  return page.method ? `/quote?method=${encodeURIComponent(page.method)}` : "/quote";
}

export function SeoLanding({ page }: { page: LandingPage }) {
  const location = isLocation(page) ? page : null;
  const content = isContent(page) ? page : null;
  const sections = location ? locationSections(location) : [];
  const intro = location
    ? locationIntro(location)
    : (content?.intro ?? "");
  const bodySections = location
    ? sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              paragraphs: section.paragraphs.slice(1),
            }
          : section,
      ).filter((section) => section.paragraphs.length > 0 || section.heading)
    : [];
  const place = location ? locationPlaceLabel(location) : null;
  const related = relatedLandingLinks(page);

  const jsonLd = [
    serviceJsonLd({
      h1: page.h1,
      description: page.description,
      path: page.path,
      city: location?.city ?? "",
      region: location?.region ?? "",
      country: location?.country ?? "CA",
      service: page.service ?? page.h1,
    }),
    location
      ? locationBreadcrumb(location)
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

      {content?.mode === "flag" ? <FlaggedReviewBanner /> : null}

      <section className="py-sp-6 border-b border-border">
        <Container>
          <p className="text-sm text-text-tertiary m-0">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>
            {location ? (
              <>
                {" "}
                /{" "}
                <Link href="/locations" className="hover:text-accent">
                  Locations we serve
                </Link>
              </>
            ) : page.path !== "/services" ? (
              <>
                {" "}
                /{" "}
                <Link href="/services" className="hover:text-accent">
                  Services
                </Link>
              </>
            ) : null}
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
            <ButtonLink href="/contact" variant="secondary">
              Contact the team
            </ButtonLink>
            <ButtonLink href={shopHref(page)} variant="secondary">
              Shop the catalogue
            </ButtonLink>
          </div>
        </Container>
      </section>

      {bodySections.length > 0 ? (
        <section className="py-sp-8">
          <Container className="max-w-[72ch] space-y-sp-5">
            {bodySections.map((section, index) => (
              <div key={`${section.heading ?? "body"}-${index}`}>
                {section.heading ? (
                  <h2 className="font-display font-bold text-lg m-0 mb-sp-3">
                    {section.heading}
                  </h2>
                ) : null}
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 48)}
                    className="text-text-secondary mb-sp-3 last:mb-0"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </Container>
        </section>
      ) : null}

      {page.path === "/how-to-order" ? <HowToSteps /> : null}
      {page.path === "/gallery" ? <Gallery /> : null}
      {page.path === "/services" ||
      page.path === "/decoration-processes" ||
      page.path === "/decoration-processes/embroidery" ||
      page.path === "/decoration-processes/custom-screen-printing" ? (
        <>
          <PrintMethods />
          <ServicesBreakdown />
        </>
      ) : null}

      {page.path === "/services" ? <ServicesLocationTeaser /> : null}

      <ShopTeaser page={page} />

      {related.length > 0 ? (
        <section className="py-sp-6 border-t border-border">
          <Container>
            <h2 className="font-display font-bold text-lg m-0 mb-sp-3">
              Related pages
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {related.map((link) => (
                <li key={link.path}>
                  <Link href={link.path} className="text-sm hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

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
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href={quoteHref(page)}>Request a Quote</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact the team
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

function FlaggedReviewBanner() {
  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-300 text-amber-950 text-sm"
    >
      <Container className="py-sp-3">
        <p className="m-0">
          <b>Flagged for review — client / Codsphere.</b> This address is held
          from the old WordPress site so it does not 404. Confirm whether it
          should stay, redirect, or be rewritten before launch. It stays{" "}
          <code>noindex</code> until that decision.
        </p>
      </Container>
    </div>
  );
}

function ShopTeaser({ page }: { page: LandingPage }) {
  return (
    <section className="py-sp-8 border-t border-border">
      <Container>
        <h2 className="font-display font-bold text-header m-0">
          Browse the catalogue
        </h2>
        <p className="text-text-secondary mt-sp-2 mb-sp-4 max-w-[64ch]">
          The old product widgets on this URL were a shop module, not article
          copy. Use the live catalogue, the quote builder, or the design studio.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href={shopHref(page)}>Open the shop</ButtonLink>
          <ButtonLink href={quoteHref(page)} variant="secondary">
            Get a quote
          </ButtonLink>
          <ButtonLink href="/design" variant="secondary">
            Design studio
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

function ServicesLocationTeaser() {
  return (
    <section className="py-sp-6 border-t border-border">
      <Container>
        <h2 className="font-display font-bold text-lg m-0 mb-sp-2">
          Locations we serve
        </h2>
        <p className="text-text-secondary mt-0 mb-sp-3 max-w-[64ch]">
          Same Vancouver floor, city pages for Metro Vancouver and the rest of
          the territory we already print for.
        </p>
        <ButtonLink href="/locations" variant="secondary">
          Browse all locations
        </ButtonLink>
      </Container>
    </section>
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

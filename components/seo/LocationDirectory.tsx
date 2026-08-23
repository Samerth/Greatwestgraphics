import Link from "next/link";
import { ButtonLink } from "@/components/shared/Button";
import { Container } from "@/components/shared/Container";
import {
  featuredLocationLinks,
  locationRegionGroups,
  locationServiceGroups,
} from "@/lib/seo/location-hub";
import { LOCATION_PAGES } from "@/lib/seo/location-pages";

export function LocationDirectory({
  heading = "Locations we serve",
  intro = "Printed and embroidered in Vancouver, shipped across Metro Vancouver, the rest of Canada, and the northwest United States. Pick a city or a service — every URL is the same live address as the previous site.",
}: {
  heading?: string;
  intro?: string;
}) {
  const featured = featuredLocationLinks();
  const regions = locationRegionGroups();
  const services = locationServiceGroups();

  return (
    <>
      <section className="py-sp-6 border-b border-border">
        <Container>
          <p className="text-sm text-text-tertiary m-0">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>{" "}
            / Locations we serve
          </p>
          <h1 className="font-display font-bold text-header mt-sp-4 m-0">
            {heading}
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[64ch] mb-0">{intro}</p>
          <p className="text-sm text-text-tertiary mt-sp-2 mb-0">
            {LOCATION_PAGES.length} city and service pages
          </p>
          <div className="mt-sp-4 flex flex-wrap gap-2.5">
            <ButtonLink href="/services">All print services</ButtonLink>
            <ButtonLink href="/quote" variant="secondary">
              Request a quote
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="py-sp-6 border-b border-border">
        <Container>
          <h2 className="font-display font-bold text-lg m-0 mb-sp-3">
            Popular cities
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 m-0 p-0 list-none">
            {featured.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-md border border-border bg-bg-raised px-3 py-3 text-sm font-bold hover:border-accent hover:text-accent"
                >
                  {link.label}
                  <span className="block text-xs font-semibold text-text-tertiary mt-1">
                    {link.region}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-sp-6 border-b border-border">
        <Container>
          <h2 className="font-display font-bold text-lg m-0 mb-sp-3">
            Browse by service
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-sp-4">
            {services.map((group) => (
              <div key={group.kind} id={`service-${group.kind}`}>
                <h3 className="font-display font-bold text-base m-0 mb-2">
                  {group.service}
                  <span className="ml-2 text-xs font-semibold text-text-tertiary">
                    {group.pages.length}
                  </span>
                </h3>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 m-0 p-0 list-none">
                  {uniqueCities(group.pages).map((page) => (
                    <li key={`${group.kind}-${page.path}`}>
                      <Link
                        href={page.path}
                        className="text-sm hover:text-accent"
                      >
                        {page.city}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container className="space-y-sp-6">
          <h2 className="font-display font-bold text-header m-0">
            All locations
          </h2>
          {regions.map((region) => (
            <div key={region.key} id={region.key.toLowerCase()}>
              <h3 className="font-display font-bold text-lg m-0 mb-sp-3">
                {region.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-sp-4">
                {region.cities.map((city) => (
                  <div key={city.citySlug}>
                    <h4 className="font-bold text-sm m-0 mb-1.5">{city.city}</h4>
                    <ul className="space-y-1 m-0 p-0 list-none">
                      {city.pages.map((page) => (
                        <li key={page.path}>
                          <Link
                            href={page.path}
                            className="text-sm text-text-secondary hover:text-accent"
                          >
                            {page.h1}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Container>
      </section>
    </>
  );
}

function uniqueCities(pages: { city: string; path: string }[]) {
  const seen = new Set<string>();
  return pages.filter((page) => {
    if (seen.has(page.city)) return false;
    seen.add(page.city);
    return true;
  });
}

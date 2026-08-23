import type { LocationPage } from "./location-pages";
import { locationPlaceLabel } from "./location-pages";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function serviceJsonLd(
  page: Pick<
    LocationPage,
    "h1" | "description" | "path" | "city" | "region" | "country" | "service"
  >,
) {
  const url = `${SITE_URL}${page.path}`;
  const areaServed = page.city
    ? {
        "@type": "City",
        name: page.city,
        containedInPlace: {
          "@type": "AdministrativeArea",
          name: page.region,
          containedInPlace: {
            "@type": "Country",
            name: page.country === "US" ? "US" : "CA",
          },
        },
      }
    : {
        "@type": "Country",
        name: "CA",
      };

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.h1,
    description: page.description,
    serviceType: page.service,
    url,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed,
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      ...items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: item.name,
        item: `${SITE_URL}${item.path}`,
      })),
    ],
  };
}

export function locationBreadcrumb(page: LocationPage) {
  return breadcrumbJsonLd([
    { name: locationPlaceLabel(page), path: page.path },
  ]);
}

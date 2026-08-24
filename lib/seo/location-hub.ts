import { withoutPublicQuoteLinks } from "../features";
import { CONTENT_PAGES, type ContentPage } from "./content-pages";
import {
  LOCATION_PAGES,
  relatedLocationPages,
  type LocationPage,
  type RelatedLink,
} from "./location-pages";

export const LOCATIONS_HUB_PATH = "/locations";
export const SERVICES_HUB_PATH = "/services";

/** Cities shoppers are most likely to look for from the footer and homepage. */
export const FEATURED_CITY_SLUGS = [
  "vancouver",
  "burnaby",
  "richmond",
  "surrey",
  "coquitlam",
  "calgary",
] as const;

const REGION_ORDER = [
  "CA-BC",
  "CA-AB",
  "CA-SK",
  "CA-MB",
  "CA-ON",
  "CA-QC",
  "US-WA",
  "US-OR",
  "US-ID",
  "US-MT",
  "US-ND",
  "US-NV",
  "US-CA",
] as const;

const REGION_LABELS: Record<string, string> = {
  "CA-BC": "British Columbia",
  "CA-AB": "Alberta",
  "CA-SK": "Saskatchewan",
  "CA-MB": "Manitoba",
  "CA-ON": "Ontario",
  "CA-QC": "Quebec",
  "US-WA": "Washington",
  "US-OR": "Oregon",
  "US-ID": "Idaho",
  "US-MT": "Montana",
  "US-ND": "North Dakota",
  "US-NV": "Nevada",
  "US-CA": "California",
};

export type FeaturedLocationLink = {
  label: string;
  href: string;
  city: string;
  region: string;
};

export type LocationCityGroup = {
  city: string;
  citySlug: string;
  region: string;
  country: LocationPage["country"];
  pages: LocationPage[];
};

export type LocationRegionGroup = {
  key: string;
  label: string;
  country: LocationPage["country"];
  cities: LocationCityGroup[];
};

export type LocationServiceGroup = {
  kind: string;
  service: string;
  pages: LocationPage[];
};

function regionKey(page: Pick<LocationPage, "country" | "region">): string {
  return `${page.country}-${page.region}`;
}

function regionLabel(key: string, page: Pick<LocationPage, "region" | "country">): string {
  return REGION_LABELS[key] ?? (page.country === "US" ? `${page.region}, USA` : page.region);
}

function regionRank(key: string): number {
  const index = (REGION_ORDER as readonly string[]).indexOf(key);
  return index === -1 ? REGION_ORDER.length : index;
}

/** Prefer a process/city landing over a narrow product URL. */
export function representativeLocationPage(citySlug: string): LocationPage | undefined {
  const pages = LOCATION_PAGES.filter((page) => page.citySlug === citySlug);
  if (pages.length === 0) return undefined;
  return [...pages].sort((a, b) => representativeScore(b) - representativeScore(a))[0];
}

function representativeScore(page: LocationPage): number {
  let score = 0;
  if (page.path.startsWith("/decoration-processes/")) score += 50;
  if (page.kind === "screen-printing") score += 20;
  if (page.kind === "t-shirt-printing") score += 15;
  if (page.kind === "embroidery") score += 10;
  if (page.path.includes("screen-printing")) score += 8;
  score -= page.path.length / 80;
  return score;
}

export function featuredLocationLinks(): FeaturedLocationLink[] {
  return FEATURED_CITY_SLUGS.flatMap((citySlug) => {
    const page = representativeLocationPage(citySlug);
    if (!page) return [];
    return [
      {
        label: page.city,
        href: page.path,
        city: page.city,
        region: page.region,
      },
    ];
  });
}

export function locationRegionGroups(): LocationRegionGroup[] {
  const byRegion = new Map<string, LocationPage[]>();
  for (const page of LOCATION_PAGES) {
    const key = regionKey(page);
    const list = byRegion.get(key) ?? [];
    list.push(page);
    byRegion.set(key, list);
  }

  return [...byRegion.entries()]
    .sort(([a], [b]) => regionRank(a) - regionRank(b) || a.localeCompare(b))
    .map(([key, pages]) => {
      const byCity = new Map<string, LocationPage[]>();
      for (const page of pages) {
        const cityKey = page.citySlug;
        const list = byCity.get(cityKey) ?? [];
        list.push(page);
        byCity.set(cityKey, list);
      }
      const cities = [...byCity.entries()]
        .map(([, cityPages]) => {
          const first = cityPages[0];
          return {
            city: first.city,
            citySlug: first.citySlug,
            region: first.region,
            country: first.country,
            pages: [...cityPages].sort((a, b) => a.h1.localeCompare(b.h1)),
          };
        })
        .sort((a, b) => b.pages.length - a.pages.length || a.city.localeCompare(b.city));

      return {
        key,
        label: regionLabel(key, pages[0]),
        country: pages[0].country,
        cities,
      };
    });
}

export function locationServiceGroups(): LocationServiceGroup[] {
  const byKind = new Map<string, LocationPage[]>();
  for (const page of LOCATION_PAGES) {
    const list = byKind.get(page.kind) ?? [];
    list.push(page);
    byKind.set(page.kind, list);
  }

  return [...byKind.entries()]
    .map(([kind, pages]) => ({
      kind,
      service: mostCommon(pages.map((page) => page.service)),
      pages: [...pages].sort((a, b) => a.city.localeCompare(b.city) || a.h1.localeCompare(b.h1)),
    }))
    .sort((a, b) => b.pages.length - a.pages.length || a.service.localeCompare(b.service));
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function uniqueLinks(links: RelatedLink[]): RelatedLink[] {
  return links.filter(
    (link, index, list) => list.findIndex((entry) => entry.path === link.path) === index,
  );
}

export function locationHubLinks(): RelatedLink[] {
  return [
    { path: LOCATIONS_HUB_PATH, label: "Locations we serve" },
    { path: SERVICES_HUB_PATH, label: "All print services" },
  ];
}

export function relatedContentLinks(page: ContentPage): RelatedLink[] {
  const hubs = locationHubLinks().filter((link) => link.path !== page.path);
  const siblings = CONTENT_PAGES.filter(
    (candidate) =>
      candidate.path !== page.path &&
      candidate.mode === "landing" &&
      candidate.indexable !== false &&
      ((page.method && candidate.method === page.method) ||
        (page.categorySlug && candidate.categorySlug === page.categorySlug) ||
        (page.service && candidate.service === page.service)),
  )
    .slice(0, 4)
    .map((candidate) => ({ path: candidate.path, label: candidate.h1 }));

  return uniqueLinks([...hubs, ...siblings]).slice(0, 8);
}

export function relatedLandingLinks(
  page: LocationPage | (ContentPage & { city?: string }),
): RelatedLink[] {
  if ("thin" in page) {
    return withoutPublicQuoteLinks(
      uniqueLinks([
        ...locationHubLinks(),
        ...(page.relatedLinks ?? []),
        ...relatedLocationPages(page, 4).map((item) => ({
          path: item.path,
          label: item.h1,
        })),
      ]),
    ).slice(0, 8);
  }
  return withoutPublicQuoteLinks(relatedContentLinks(page));
}

/** General-content landings that should stay one click from the footer. */
export function featuredContentLinks(): RelatedLink[] {
  return [
    { path: "/how-to-order", label: "How to order" },
    { path: "/decoration-processes", label: "Decoration processes" },
  ];
}

/** Footer / homepage entries that must resolve to live slugs. */
export function siteFacingSeoLinks(): RelatedLink[] {
  return [
    ...locationHubLinks(),
    ...featuredContentLinks(),
    ...featuredLocationLinks().map((link) => ({
      path: link.href,
      label: `${link.label} printing`,
    })),
  ];
}

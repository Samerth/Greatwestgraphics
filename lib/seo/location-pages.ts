import { canonicalizePath } from "./paths";
import { cleanSeoText } from "./clean";
import { uniqueThinSections } from "./thin-copy";
import records from "./data/location-pages.json";

export type LocationSection = {
  heading: string | null;
  paragraphs: string[];
};

export type RelatedLink = {
  path: string;
  label: string;
};

export type LocationPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  thin: boolean;
  city: string;
  region: string;
  country: "CA" | "US";
  citySlug: string;
  service: string;
  kind: string;
  categorySlug: string | null;
  method: string | null;
  wordCount?: number;
  sections?: LocationSection[];
  relatedLinks?: RelatedLink[];
};

export const LOCATION_PAGES: LocationPage[] = (records as LocationPage[]).map(
  (page) => ({
    ...page,
    title: cleanSeoText(page.title),
    description: cleanSeoText(page.description),
    h1: cleanSeoText(page.h1),
  }),
);

const BY_PATH = new Map(
  LOCATION_PAGES.map((page) => [canonicalizePath(page.path), page]),
);

export function getLocationPage(path: string): LocationPage | undefined {
  return BY_PATH.get(canonicalizePath(path));
}

export function locationIntro(page: LocationPage): string {
  const written = locationSections(page)[0]?.paragraphs[0];
  if (written) return written;
  const place = `${page.city}, ${page.region}`;
  const from =
    page.city === "Vancouver"
      ? "from our shop on East Kent Avenue South"
      : "from our Vancouver production floor";
  return `Great West Graphics provides ${page.service.toLowerCase()} for ${place} ${from}. Typical production is 5–7 business days; rush work is available when the in-hands date requires it.`;
}

export function locationSections(page: LocationPage): LocationSection[] {
  if (page.thin || !page.sections?.length) {
    return uniqueThinSections(page);
  }
  return page.sections.map((section) => ({
    heading: section.heading ? cleanSeoText(section.heading) : null,
    paragraphs: section.paragraphs.map(cleanSeoText).filter(Boolean),
  }));
}

export function locationPlaceLabel(page: LocationPage): string {
  return page.country === "US"
    ? `${page.city}, ${page.region}, USA`
    : `${page.city}, ${page.region}, Canada`;
}

export function relatedLocationPages(page: LocationPage, limit = 4): LocationPage[] {
  const others = LOCATION_PAGES.filter((candidate) => candidate.path !== page.path);
  const sameCity = others.filter((candidate) => candidate.citySlug === page.citySlug);
  const sameKind = others.filter(
    (candidate) => candidate.kind === page.kind && candidate.citySlug !== page.citySlug,
  );
  const cityTake = Math.min(sameCity.length, Math.max(1, Math.ceil(limit / 2)));
  const picked = sameCity.slice(0, cityTake);
  const seen = new Set(picked.map((item) => item.path));
  for (const candidate of [...sameKind, ...others]) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}

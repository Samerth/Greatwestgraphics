import { canonicalizePath } from "./paths";
import records from "./data/location-pages.json";

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
};

export const LOCATION_PAGES = records as LocationPage[];

const BY_PATH = new Map(
  LOCATION_PAGES.map((page) => [canonicalizePath(page.path), page]),
);

export function getLocationPage(path: string): LocationPage | undefined {
  return BY_PATH.get(canonicalizePath(path));
}

export function locationIntro(page: LocationPage): string {
  const place = `${page.city}, ${page.region}`;
  const from =
    page.city === "Vancouver"
      ? "from our shop on East Kent Avenue South"
      : "from our Vancouver production floor";
  return `Great West Graphics provides ${page.service.toLowerCase()} for ${place} ${from}. Typical production is 5–7 business days; rush work is available when the in-hands date requires it.`;
}

export function locationPlaceLabel(page: LocationPage): string {
  return page.country === "US"
    ? `${page.city}, ${page.region}, USA`
    : `${page.city}, ${page.region}, Canada`;
}

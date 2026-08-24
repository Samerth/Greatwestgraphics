import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getContentPage } from "./content-pages";
import { getLocationPage, LOCATION_PAGES } from "./location-pages";
import {
  featuredContentLinks,
  featuredLocationLinks,
  FEATURED_CITY_SLUGS,
  locationHubLinks,
  locationRegionGroups,
  locationServiceGroups,
  relatedContentLinks,
  relatedLandingLinks,
  representativeLocationPage,
  siteFacingSeoLinks,
} from "./location-hub";
import { relatedLocationPages } from "./location-pages";

describe("location hub", () => {
  it("does not replace a WordPress slug with /locations", () => {
    expect(getLocationPage("/locations")).toBeUndefined();
    expect(getContentPage("/locations")).toBeUndefined();
    expect(LOCATION_PAGES.some((page) => page.path === "/locations")).toBe(
      false,
    );
  });

  it("groups every location page under a region and a service", () => {
    const regions = locationRegionGroups();
    const services = locationServiceGroups();
    const regionCount = regions.reduce(
      (sum, region) =>
        sum + region.cities.reduce((inner, city) => inner + city.pages.length, 0),
      0,
    );
    const serviceCount = services.reduce(
      (sum, group) => sum + group.pages.length,
      0,
    );
    expect(regionCount).toBe(LOCATION_PAGES.length);
    expect(serviceCount).toBe(LOCATION_PAGES.length);
    expect(regions.some((region) => region.label === "British Columbia")).toBe(
      true,
    );
  });

  it("picks live representative landings for featured cities", () => {
    const links = featuredLocationLinks();
    expect(links).toHaveLength(FEATURED_CITY_SLUGS.length);
    for (const link of links) {
      expect(getLocationPage(link.href), link.href).toBeTruthy();
    }
    expect(representativeLocationPage("vancouver")?.path).toBe(
      "/decoration-processes/custom-screen-printing/vancouver",
    );
  });

  it("exposes hub and featured links that all resolve", () => {
    expect(locationHubLinks().map((link) => link.path)).toEqual([
      "/locations",
      "/services",
    ]);
    for (const link of siteFacingSeoLinks()) {
      if (link.path === "/locations") continue;
      expect(
        getLocationPage(link.path) || getContentPage(link.path),
        link.path,
      ).toBeTruthy();
    }
  });

  it("interlinks a landing to the same city and the same service", () => {
    const page = getLocationPage("/screen-printing-in-burnaby");
    expect(page).toBeTruthy();
    const related = relatedLocationPages(page!, 4);
    expect(related.every((item) => item.path !== page!.path)).toBe(true);
    expect(related.some((item) => item.citySlug === "burnaby")).toBe(true);
    expect(
      related.some(
        (item) => item.kind === "screen-printing" && item.citySlug !== "burnaby",
      ),
    ).toBe(true);
  });

  it("puts the locations and services hubs on every landing", () => {
    const location = getLocationPage("/screen-printing-tsawwassen");
    const content = getContentPage("/custom-t-shirts");
    expect(location).toBeTruthy();
    expect(content).toBeTruthy();
    expect(relatedLandingLinks(location!).map((link) => link.path)).toEqual(
      expect.arrayContaining(["/locations", "/services"]),
    );
    expect(relatedContentLinks(content!).map((link) => link.path)).toEqual(
      expect.arrayContaining(["/locations", "/services"]),
    );
    expect(relatedLandingLinks(location!).map((link) => link.path)).not.toContain(
      "/get-a-quote",
    );
    expect(relatedLandingLinks(location!).map((link) => link.path)).not.toContain(
      "/quote",
    );
    const kenora = getLocationPage("/screen-printing-and-embroidery-in-kenora");
    expect(kenora?.relatedLinks?.some((link) => link.path === "/get-a-quote")).toBe(
      true,
    );
    expect(relatedLandingLinks(kenora!).map((link) => link.path)).not.toContain(
      "/get-a-quote",
    );
  });

  it("wires the hubs into the header, footer, and homepage", () => {
    const footer = readFileSync(
      resolve(process.cwd(), "components/layout/Footer.tsx"),
      "utf8",
    );
    const header = readFileSync(
      resolve(process.cwd(), "components/layout/Header.tsx"),
      "utf8",
    );
    const home = readFileSync(
      resolve(process.cwd(), "components/home/FigmaHomeSections.tsx"),
      "utf8",
    );
    const layout = readFileSync(
      resolve(process.cwd(), "app/layout.tsx"),
      "utf8",
    );
    expect(footer).toContain('href: "/locations"');
    expect(footer).toContain('href: "/services"');
    expect(footer).toContain('href: "/how-to-order"');
    expect(footer).toContain('href: "/decoration-processes"');
    expect(featuredContentLinks().map((link) => link.path)).toEqual([
      "/how-to-order",
      "/decoration-processes",
    ]);
    expect(header).toContain('href="/services"');
    expect(header).toContain('href="/locations"');
    expect(home).toContain('href="/locations"');
    expect(home).toContain('href="/services"');
    expect(layout).toContain("GoogleAnalytics");
  });
});

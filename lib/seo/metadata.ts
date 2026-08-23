import type { Metadata } from "next";
import {
  contentCanonicalPath,
  getContentPage,
  type ContentPage,
} from "./content-pages";
import { publicRobots } from "./indexing";
import type { LocationPage } from "./location-pages";

const DEFAULT_OG_IMAGE = "/images/hero-press.jpg";

export function seoPageMetadata(
  page: Pick<LocationPage | ContentPage, "title" | "description" | "path"> & {
    canonicalPath?: string;
    indexable?: boolean;
  },
): Metadata {
  const canonical = page.canonicalPath ?? page.path;
  const indexable = page.indexable !== false;

  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical },
    robots: publicRobots(indexable),
    openGraph: {
      type: "website",
      title: page.title,
      description: page.description,
      url: canonical,
      images: [{ url: DEFAULT_OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export function contentMetadata(path: string): Metadata {
  const page = getContentPage(path);
  if (!page) {
    return { robots: publicRobots(false) };
  }
  return seoPageMetadata({
    ...page,
    canonicalPath: contentCanonicalPath(page),
  });
}

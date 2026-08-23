import type { Metadata } from "next";
import { cleanSeoText } from "./clean";
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
  const title = cleanSeoText(page.title);
  const description = cleanSeoText(page.description);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: publicRobots(indexable),
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: [{ url: DEFAULT_OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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

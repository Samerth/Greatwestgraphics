import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SeoLanding } from "@/components/seo/SeoLanding";
import { getContentPage } from "@/lib/seo/content-pages";
import { catchAllStaticPaths, resolveLegacyRoute } from "@/lib/seo/inventory";
import { getLocationPage } from "@/lib/seo/location-pages";
import { seoPageMetadata } from "@/lib/seo/metadata";
import { pathFromSegments, segmentsFromPath } from "@/lib/seo/paths";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export function generateStaticParams() {
  return catchAllStaticPaths().map((path) => ({
    slug: segmentsFromPath(path),
  }));
}

/**
 * Only inventoried SEO slugs render here. Unknown paths 404 — they are not
 * 301'd to a guessed page or the homepage. Retired/transactional URLs 301
 * from the explicit allowlist in next.config / proxy before this runs.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = pathFromSegments(slug);
  const route = resolveLegacyRoute(path);

  if (route.type === "redirect") {
    permanentRedirect(route.to);
  }

  if (route.type === "location") {
    const page = getLocationPage(path);
    if (page) return seoPageMetadata(page);
  }

  if (route.type === "content") {
    const page = getContentPage(path);
    if (page) {
      return seoPageMetadata({
        ...page,
        canonicalPath: page.canonicalPath ?? page.path,
      });
    }
  }

  return {};
}

export default async function LegacySeoPage({ params }: PageProps) {
  const { slug } = await params;
  const path = pathFromSegments(slug);
  const route = resolveLegacyRoute(path);

  if (route.type === "redirect") {
    permanentRedirect(route.to);
  }

  if (route.type === "location") {
    const page = getLocationPage(path);
    if (page) return <SeoLanding page={page} />;
  }

  if (route.type === "content") {
    const page = getContentPage(path);
    if (page) return <SeoLanding page={page} />;
  }

  notFound();
}

import type { Metadata } from "next";
import { LocationDirectory } from "@/components/seo/LocationDirectory";
import { publicRobots } from "@/lib/seo/indexing";
import { breadcrumbJsonLd } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Locations we serve - Great West Graphics",
  description:
    "Screen printing and embroidery from Vancouver for Metro Vancouver, the rest of Canada, and the northwest United States. Browse every city and service page.",
  alternates: { canonical: "/locations" },
  robots: publicRobots(),
};

export default function LocationsPage() {
  const jsonLd = breadcrumbJsonLd([
    { name: "Locations we serve", path: "/locations" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LocationDirectory />
    </>
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#organization`,
    name: "Great West Graphics",
    url: SITE_URL,
    image: `${SITE_URL}/images/hero-press.jpg`,
    logo: `${SITE_URL}/images/logo.png`,
    description:
      "Vancouver screen printing and embroidery studio offering custom apparel, promotional products, safety wear and signage with in-house design proofing.",
    telephone: "+1-604-321-3285",
    faxNumber: "+1-604-321-2821",
    email: "info@greatwestgraphics.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "#105 – 342 East Kent Avenue South",
      addressLocality: "Vancouver",
      addressRegion: "BC",
      postalCode: "V5X 4N6",
      addressCountry: "CA",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ],
      opens: "08:30",
      closes: "16:30",
    },
    priceRange: "$$",
    // Was an empty array while the footer linked three real profiles. sameAs
    // is how a search engine ties this markup to those accounts, so leaving it
    // empty threw away the corroboration we already had sitting in the footer.
    sameAs: [
      "https://www.instagram.com/greatwestgraphics/",
      "https://www.facebook.com/GreatWestGraphicsInc/",
      "https://www.linkedin.com/company/great-west-graphics",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

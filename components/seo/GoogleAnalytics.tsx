import Script from "next/script";
import { GA4_MEASUREMENT_ID } from "@/lib/seo/analytics";
import { AnalyticsClickTracker } from "./AnalyticsClickTracker";

/**
 * Existing GA4 property (G-0M446YCNS9) via gtag.js on every page.
 * Do not swap this for a new Measurement ID.
 */
export function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gwg-ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA4_MEASUREMENT_ID}');
        `}
      </Script>
      <AnalyticsClickTracker />
    </>
  );
}

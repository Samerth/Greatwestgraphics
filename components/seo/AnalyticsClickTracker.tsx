"use client";

import { useEffect } from "react";
import { classifyContactHref, trackContactClick } from "@/lib/seo/analytics";

/**
 * Spec §4: tel: and mailto: clicks are GA4 events (and generate_lead)
 * so they can be marked as key events in the existing property.
 */
export function AnalyticsClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      const kind = classifyContactHref(href);
      if (!kind) return;
      trackContactClick(kind, href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

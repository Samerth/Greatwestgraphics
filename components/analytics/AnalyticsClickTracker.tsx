"use client";

import { useEffect } from "react";
import { trackContactLinkClick } from "@/lib/analytics/gtag";

/**
 * Document-level tel:/mailto: clicks so every page is covered without
 * wrapping individual links. Events: `tel` and `mailto`.
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
      trackContactLinkClick(href);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

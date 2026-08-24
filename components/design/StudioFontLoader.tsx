"use client";

import { useEffect } from "react";
import {
  ensureStudioFontsLoaded,
  studioGoogleFontsHref,
} from "@/lib/commerce/studio-fonts";

/**
 * Loads OFL Google Fonts at runtime (not `next/font/google`, which fetches
 * during docker build) and waits for `document.fonts` so Konva can paint them.
 */
export function StudioFontLoader({
  onReady,
}: {
  onReady?: () => void;
}) {
  useEffect(() => {
    const href = studioGoogleFontsHref();
    if (href && !document.getElementById("gwg-studio-fonts")) {
      const link = document.createElement("link");
      link.id = "gwg-studio-fonts";
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
    void ensureStudioFontsLoaded().then(() => onReady?.());
  }, [onReady]);
  return null;
}

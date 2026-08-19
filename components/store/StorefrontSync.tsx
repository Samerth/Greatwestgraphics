"use client";

import { useLayoutEffect } from "react";
import { useCartStore } from "@/lib/store/cart";

/**
 * Tells the cart which storefront this page is serving so Add-to-cart stamps
 * the current slug and the header only counts this store's lines.
 */
export function StorefrontSync({
  slug,
  isPublic,
}: {
  slug: string;
  isPublic: boolean;
}) {
  useLayoutEffect(() => {
    const current = useCartStore.getState().activeStore;
    if (current.slug !== slug || current.isPublic !== isPublic) {
      useCartStore.getState().setActiveStore({ slug, isPublic });
    }
  }, [slug, isPublic]);
  return null;
}

"use client";

import Image, { type ImageProps } from "next/image";
import { isVendorImageUrl } from "@/lib/commerce/catalog-images";

/**
 * `next/image` for product photography.
 *
 * Vendor-hosted photos (SanMar, S&S) bypass our image optimiser and load
 * straight from the vendor's CDN; anything else — local assets, uploaded
 * artwork — is optimised as normal. See `isVendorImageUrl` for why: the
 * optimiser runs on a half-CPU container and could not keep up with a page
 * of catalogue tiles being scrolled, which is what left tiles blank until
 * the product was opened (client call, 10 Sep).
 *
 * A single component rather than an `unoptimized` prop at every call site,
 * so a new card somewhere cannot quietly reintroduce the queue.
 */
export function CatalogImage({
  alt,
  unoptimized,
  referrerPolicy,
  ...props
}: ImageProps) {
  const src = typeof props.src === "string" ? props.src : null;
  const vendor = isVendorImageUrl(src);
  return (
    <Image
      {...props}
      alt={alt}
      unoptimized={unoptimized ?? vendor}
      // Loading straight from the vendor means the *browser* makes the
      // request, and a browser sends a Referer header naming our site.
      // media.sanmarcanada.com refuses image requests that carry a foreign
      // Referer (hotlink protection — 403), which the optimiser never hit
      // because a server-side fetch sends none. So a vendor photo is fetched
      // with no Referer at all, exactly as the optimiser used to. Found the
      // hard way: every SanMar photo went blank on localhost the moment the
      // optimiser was bypassed, while every S&S photo kept loading.
      referrerPolicy={referrerPolicy ?? (vendor ? "no-referrer" : undefined)}
    />
  );
}

import type { DesignSide } from "@gwg/contracts";

export type GarmentPhotoSet = {
  colorFrontImageUrl?: string | null;
  colorSideImageUrl?: string | null;
  colorBackImageUrl?: string | null;
  styleImageUrl?: string | null;
};

export type GarmentBackdrop = {
  url: string;
  source: "photo" | "template";
  mirror: boolean;
};

export const SLEEVE_TEMPLATE_LEFT = "/images/studio/sleeve-left.jpg";
export const SLEEVE_TEMPLATE_RIGHT = "/images/studio/sleeve-right.jpg";
export const GARMENT_FALLBACK = "/images/t-shirt.png";

function photoUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed || null;
}

/** A side/back URL that is just the chest shot again does not count. */
export function distinctPhoto(
  url: string | null | undefined,
  ...avoid: Array<string | null | undefined>
): string | null {
  const value = photoUrl(url);
  if (!value) return null;
  return avoid.some((other) => photoUrl(other) === value) ? null : value;
}

/**
 * Which backdrop a studio view should draw.
 *
 * Sleeves use a vendor side photo when one exists and is not the chest
 * shot. Otherwise they use an on-body sleeve photo — never the front
 * photo. Front/back still use the vendor photos.
 */
export function garmentBackdropForSide(
  side: DesignSide,
  photos: GarmentPhotoSet,
): GarmentBackdrop {
  const front = photoUrl(photos.colorFrontImageUrl) || photoUrl(photos.styleImageUrl);
  const back = distinctPhoto(photos.colorBackImageUrl);
  const sidePhoto = distinctPhoto(
    photos.colorSideImageUrl,
    photos.colorFrontImageUrl,
    photos.styleImageUrl,
  );

  if (side === "front") {
    return {
      url: front || GARMENT_FALLBACK,
      source: front ? "photo" : "template",
      mirror: false,
    };
  }

  if (side === "back") {
    if (back) return { url: back, source: "photo", mirror: false };
    if (front) return { url: front, source: "photo", mirror: true };
    return { url: GARMENT_FALLBACK, source: "template", mirror: true };
  }

  if (side === "left") {
    if (sidePhoto) return { url: sidePhoto, source: "photo", mirror: false };
    return { url: SLEEVE_TEMPLATE_LEFT, source: "template", mirror: false };
  }

  if (sidePhoto) return { url: sidePhoto, source: "photo", mirror: true };
  return { url: SLEEVE_TEMPLATE_RIGHT, source: "template", mirror: false };
}

/** Konva proofs need a same-origin URL. Local templates and SVGs must not
 * go through the image optimizer — Next rejects SVG there and the stage
 * stays blank. */
export function studioCanvasImageUrl(backdrop: GarmentBackdrop): string {
  if (!backdrop.url) return "";
  if (
    backdrop.source === "template" ||
    backdrop.url.startsWith("/images/") ||
    /\.svg(\?|#|$)/i.test(backdrop.url)
  ) {
    return backdrop.url;
  }
  return `/_next/image?url=${encodeURIComponent(backdrop.url)}&w=640&q=75`;
}

export function garmentBackdrops(
  photos: GarmentPhotoSet,
): Record<DesignSide, GarmentBackdrop> {
  return {
    front: garmentBackdropForSide("front", photos),
    back: garmentBackdropForSide("back", photos),
    left: garmentBackdropForSide("left", photos),
    right: garmentBackdropForSide("right", photos),
  };
}

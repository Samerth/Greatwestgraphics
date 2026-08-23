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

export const SLEEVE_TEMPLATE_LEFT = "/images/studio/sleeve-left.svg";
export const SLEEVE_TEMPLATE_RIGHT = "/images/studio/sleeve-right.svg";
export const GARMENT_FALLBACK = "/images/t-shirt.png";

/**
 * Which backdrop a studio view should draw.
 *
 * Vendors almost never send a real sleeve photo. The old fallback reused the
 * front chest shot, so Left/Right Sleeve looked empty or like the art sat on
 * the torso. Sleeves now stay on a side photo when one exists, otherwise a
 * labeled sleeve template. Front/back still use the vendor photos.
 */
export function garmentBackdropForSide(
  side: DesignSide,
  photos: GarmentPhotoSet,
): GarmentBackdrop {
  const front = photos.colorFrontImageUrl || photos.styleImageUrl || null;
  const back = photos.colorBackImageUrl || null;
  const sidePhoto = photos.colorSideImageUrl || null;

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

/** Konva proofs need a same-origin URL. Local templates must not go through
 * the image optimizer — Next rejects SVG there and the stage stays blank. */
export function studioCanvasImageUrl(backdrop: GarmentBackdrop): string {
  if (!backdrop.url) return "";
  if (backdrop.source === "template" || backdrop.url.startsWith("/images/")) {
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

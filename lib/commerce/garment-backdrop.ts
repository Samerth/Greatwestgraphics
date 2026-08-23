import type { DesignSide } from "@gwg/contracts";

export type GarmentPhotoSet = {
  colorFrontImageUrl?: string | null;
  colorBackImageUrl?: string | null;
  colorSideImageUrl?: string | null;
  styleImageUrl?: string | null;
};

/** Fractional crop of a source photo, origin top-left. */
export type PhotoCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GarmentBackdrop = {
  url: string;
  source: "photo" | "template";
  mirror: boolean;
  crop?: PhotoCrop;
};

export type BackdropImageStyle = {
  position: "absolute";
  inset?: string;
  margin?: string;
  left?: string;
  top?: string;
  width: string;
  height: string;
  maxWidth?: string;
  objectFit: "contain" | "fill";
  transform?: string;
};

export const GARMENT_FALLBACK = "/images/t-shirt.png";

/**
 * Half of a front-facing colorway photo. Viewer-right is the garment's
 * left sleeve; viewer-left is the right sleeve. Used only when the vendor
 * did not send a distinct side shot — never the full chest frame.
 */
export const SLEEVE_CROP_LEFT: PhotoCrop = {
  x: 0.5,
  y: 0.08,
  width: 0.46,
  height: 0.8,
};
export const SLEEVE_CROP_RIGHT: PhotoCrop = {
  x: 0.04,
  y: 0.08,
  width: 0.46,
  height: 0.8,
};

function photoUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed || null;
}

/** Filename angle when the vendor named it. Unlabeled S&S side URLs stay unknown. */
export function namedVendorView(
  url: string | null | undefined,
): "front" | "side" | "back" | null {
  const value = photoUrl(url);
  if (!value) return null;
  let path = value;
  try {
    path = new URL(value).pathname;
  } catch {
    // Keep the raw string when it is not a valid URL.
  }
  const file = (path.split("/").pop() ?? path).toLowerCase();
  if (/(direct[-_]?)?side|_oms\b|_s_fm\b|_sl_fm\b/.test(file)) return "side";
  if (/\bback\b|_back|_omb\b|_b_fm\b|_bk\./.test(file)) return "back";
  if (/\bfront\b|_front|_omf\b|_f_fm\b|_ft\./.test(file)) return "front";
  return null;
}

/** A side/back URL that is just another stored view again does not count. */
export function distinctPhoto(
  url: string | null | undefined,
  ...avoid: Array<string | null | undefined>
): string | null {
  const value = photoUrl(url);
  if (!value) return null;
  return avoid.some((other) => photoUrl(other) === value) ? null : value;
}

/**
 * A catalog "side" URL only counts when it is a different address and is
 * not named front or back. Unlabeled URLs (typical S&S `colorSideImage`)
 * still count when they are distinct.
 */
export function usableSidePhoto(
  url: string | null | undefined,
  ...avoid: Array<string | null | undefined>
): string | null {
  const value = distinctPhoto(url, ...avoid);
  if (!value) return null;
  const named = namedVendorView(value);
  if (named === "front" || named === "back") return null;
  return value;
}

function sleeveFromColorway(
  photos: { front: string | null },
  crop: PhotoCrop,
): GarmentBackdrop {
  if (photos.front) {
    return { url: photos.front, source: "photo", mirror: false, crop };
  }
  return { url: GARMENT_FALLBACK, source: "template", mirror: false, crop };
}

/**
 * Which backdrop a studio view should draw.
 *
 * Neither S&S nor SanMar ships a dedicated left/right sleeve close-up.
 * Sleeves use a vendor side photo when one exists and is not the chest
 * or back shot. Otherwise they crop the sleeve from that colorway's real
 * front photo — never the full chest frame, never a fake heather mock,
 * never a cartoon shell. Front/back still use the vendor photos.
 */
export function garmentBackdropForSide(
  side: DesignSide,
  photos: GarmentPhotoSet,
): GarmentBackdrop {
  const front =
    photoUrl(photos.colorFrontImageUrl) || photoUrl(photos.styleImageUrl);
  const back = distinctPhoto(
    photos.colorBackImageUrl,
    photos.colorFrontImageUrl,
    photos.styleImageUrl,
  );
  const sidePhoto = usableSidePhoto(
    photos.colorSideImageUrl,
    photos.colorFrontImageUrl,
    photos.styleImageUrl,
    photos.colorBackImageUrl,
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
    return sleeveFromColorway({ front }, SLEEVE_CROP_LEFT);
  }

  if (sidePhoto) return { url: sidePhoto, source: "photo", mirror: true };
  return sleeveFromColorway({ front }, SLEEVE_CROP_RIGHT);
}

/** Konva proofs need a same-origin URL. Local `/images/` and SVGs must not
 * go through the image optimizer — Next 16 rejects SVG there and the stage
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

/** CSS that matches the Konva crop: the crop rect fills the box. */
export function backdropImageStyle(
  crop: PhotoCrop | undefined,
  mirror: boolean,
): BackdropImageStyle {
  if (!crop) {
    return {
      position: "absolute",
      inset: "0",
      margin: "auto",
      width: "100%",
      height: "100%",
      objectFit: "contain",
      transform: mirror ? "scaleX(-1)" : undefined,
    };
  }
  return {
    position: "absolute",
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    maxWidth: "none",
    objectFit: "fill",
    transform: mirror ? "scaleX(-1)" : undefined,
  };
}

export function cropPixels(
  crop: PhotoCrop,
  naturalWidth: number,
  naturalHeight: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: crop.x * naturalWidth,
    y: crop.y * naturalHeight,
    width: crop.width * naturalWidth,
    height: crop.height * naturalHeight,
  };
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

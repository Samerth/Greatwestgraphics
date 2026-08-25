import type { DesignSide } from "@gwg/contracts";

export type GarmentPhotoSet = {
  colorFrontImageUrl?: string | null;
  colorBackImageUrl?: string | null;
  colorSideImageUrl?: string | null;
  styleImageUrl?: string | null;
  styleName?: string | null;
  /** Manufacturer title, e.g. "Men's Ultimate365 Elevated Hoodie". */
  styleTitle?: string | null;
};

/** Fractional crop of a source photo, origin top-left. */
export type PhotoCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlateRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GarmentBackdrop = {
  url: string;
  source: "photo" | "template" | "side-view";
  mirror: boolean;
  crop?: PhotoCrop;
  /**
   * Sleeve views sit as a contained product plate (padding around the
   * garment), not a crop stretched to fill the square. Matches the
   * Coastal Reign designer: L/R sleeve is its own framed garment angle.
   */
  plate?: boolean;
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
  opacity?: number;
};

export const GARMENT_FALLBACK = "/images/t-shirt.png";

/** Padding around a sleeve plate, as a fraction of the square canvas. */
export const SLEEVE_PLATE_INSET = 0.08;

/** Photorealistic 3/4 side plates — not a crop of the front photo. */
export const STUDIO_SIDE_HOODIE = "/images/studio/side-hoodie.png";
export const STUDIO_SIDE_TEE = "/images/studio/side-tee.png";

export function studioSideViewTemplate(
  ...names: Array<string | null | undefined>
): string {
  const name = names.filter(Boolean).join(" ").toLowerCase();
  if (/(hood|fleece|sweat|jacket|zip)/.test(name)) return STUDIO_SIDE_HOODIE;
  return STUDIO_SIDE_TEE;
}

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

function sleeveSideView(
  photos: Pick<GarmentPhotoSet, "styleName" | "styleTitle">,
  mirror: boolean,
): GarmentBackdrop {
  return {
    url: studioSideViewTemplate(photos.styleName, photos.styleTitle),
    source: "side-view",
    mirror,
    plate: true,
  };
}

/**
 * Which backdrop a studio view should draw.
 *
 * Neither S&S nor SanMar ships a dedicated left/right sleeve close-up.
 * Sleeves use a vendor side photo when one exists and is not the chest
 * or back shot. Otherwise they use a photorealistic 3/4 side plate
 * tinted to the colourway — never a crop of the front photo, never a
 * cartoon outline. Front/back still use the vendor photos uncropped.
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
    if (sidePhoto) {
      return { url: sidePhoto, source: "photo", mirror: false, plate: true };
    }
    return sleeveSideView(photos, false);
  }

  if (sidePhoto) {
    return { url: sidePhoto, source: "photo", mirror: true, plate: true };
  }
  return sleeveSideView(photos, true);
}

/** When a vendor photo 403s in the browser, fall back to a local plate. */
export function studioBackdropFallbackUrl(
  backdrop: Pick<GarmentBackdrop, "url" | "source" | "plate">,
  photos: Pick<GarmentPhotoSet, "styleName" | "styleTitle"> = {},
): string {
  if (backdrop.source === "photo" && backdrop.plate) {
    const plate = studioSideViewTemplate(photos.styleName, photos.styleTitle);
    return plate !== backdrop.url ? plate : GARMENT_FALLBACK;
  }
  return GARMENT_FALLBACK;
}

/** Konva proofs need a same-origin URL. Local `/images/` and SVGs must not
 * go through the image optimizer — Next 16 rejects SVG there and the stage
 * stays blank. */
export function studioCanvasImageUrl(backdrop: GarmentBackdrop): string {
  if (!backdrop.url) return "";
  if (
    backdrop.source === "template" ||
    backdrop.source === "side-view" ||
    backdrop.url.startsWith("/images/") ||
    /\.svg(\?|#|$)/i.test(backdrop.url)
  ) {
    return backdrop.url;
  }
  return `/_next/image?url=${encodeURIComponent(backdrop.url)}&w=640&q=75`;
}

/**
 * Where a (cropped) photo sits in the square canvas.
 * `sourceAspect` is naturalWidth / naturalHeight. CSS callers pass 1 —
 * vendor colorway photos are square.
 */
export function plateContainRect(
  crop: PhotoCrop | undefined,
  sourceAspect: number,
  inset: number,
): PlateRect {
  const safeAspect = sourceAspect > 0 ? sourceAspect : 1;
  const plate = Math.max(0.1, 1 - 2 * Math.max(0, inset));
  const plateX = (1 - plate) / 2;
  const plateY = (1 - plate) / 2;
  const aspect = crop
    ? (crop.width / crop.height) * safeAspect
    : safeAspect;
  if (aspect >= 1) {
    const height = plate / aspect;
    return {
      x: plateX,
      y: plateY + (plate - height) / 2,
      width: plate,
      height,
    };
  }
  const width = plate * aspect;
  return {
    x: plateX + (plate - width) / 2,
    y: plateY,
    width,
    height: plate,
  };
}

/** CSS that maps a crop rect onto its parent box. */
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

/**
 * Frame + image styles so CSS and Konva share the same plate geometry.
 * Sleeve plates letterbox inside an inset; front/back still fill the canvas.
 */
export function framedBackdropStyles(
  backdrop: Pick<GarmentBackdrop, "crop" | "mirror" | "plate">,
  sourceAspect = 1,
): {
  frame: {
    position: "absolute";
    left: string;
    top: string;
    width: string;
    height: string;
    overflow: "hidden";
  };
  image: BackdropImageStyle;
} {
  const inset = backdrop.plate ? SLEEVE_PLATE_INSET : 0;
  const box =
    backdrop.plate || backdrop.crop
      ? plateContainRect(backdrop.crop, sourceAspect, inset)
      : { x: 0, y: 0, width: 1, height: 1 };
  return {
    frame: {
      position: "absolute",
      left: `${box.x * 100}%`,
      top: `${box.y * 100}%`,
      width: `${box.width * 100}%`,
      height: `${box.height * 100}%`,
      overflow: "hidden",
    },
    image: backdropImageStyle(
      backdrop.crop,
      Boolean(backdrop.mirror && !backdrop.crop),
    ),
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

/** Photorealistic L/R plates — not a real vendor side photo. */
export function isStudioSideRepresentation(
  backdrop: Pick<GarmentBackdrop, "source">,
): boolean {
  return backdrop.source === "side-view";
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

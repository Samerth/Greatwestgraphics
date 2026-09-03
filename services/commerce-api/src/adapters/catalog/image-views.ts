/**
 * SanMar PromoStandards media is a bag of URLs, not labeled front/side/back.
 * When a filename names the angle, use that. Never invent a sleeve photo
 * from list order — unique[1] is often the back, not a side shot.
 */

export type ImageViews = {
  imageFront?: string;
  imageSide?: string;
  imageBack?: string;
};

export function classifyVendorImageRole(
  url: string,
): "front" | "side" | "back" | "unknown" {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Keep the raw string when it is not a valid URL.
  }
  const file = (path.split("/").pop() ?? path).toLowerCase();
  if (/(direct[-_]?)?side|_oms\b|_s_fm\b|_sl_fm\b/.test(file)) return "side";
  if (/\bback\b|_back|_omb\b|_b_fm\b|_bk\./.test(file)) return "back";
  if (/\bfront\b|_front|_omf\b|_f_fm\b|_ft\./.test(file)) return "front";
  return "unknown";
}

/**
 * True when a vendor filename signals an on-model / lifestyle photo rather
 * than a flat/ghost product shot. SanMar's media commonly flags this with
 * `_omf` / `_oms` / `_omb` ("on-model front/side/back"), or the word
 * "model"/"lifestyle" in the filename. This does not change which angle a
 * photo is classified as (front/side/back) — only which photo wins when a
 * colourway has more than one candidate for the same angle (CodSphere UAT:
 * "Use model/on-body product imagery as the primary catalogue image
 * wherever available").
 */
export function isModelShot(url: string): boolean {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Keep the raw string when it is not a valid URL.
  }
  const file = (path.split("/").pop() ?? path).toLowerCase();
  return /_om[fsb]\b|\bmodel\b|on[-_]?model|\blifestyle\b/.test(file);
}

/** Prefer distinct front / side / back URLs when a vendor returns a list. */
export function pickImageViews(
  urls: Array<string | null | undefined> | undefined,
): ImageViews {
  const unique = [
    ...new Set(
      (urls ?? [])
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter((url) => /^https?:\/\//i.test(url)),
    ),
  ];

  const classified = unique.map((url) => ({
    url,
    role: classifyVendorImageRole(url),
  }));
  const named = (role: "front" | "side" | "back") =>
    classified.find((row) => row.role === role)?.url;

  const imageFront = named("front") ?? unique[0];
  const used = new Set<string>();
  if (imageFront) used.add(imageFront);

  // Only a filename that names the angle is a side shot. Remaining
  // unlabeled URLs are not sleeves — the studio crops the colorway photo.
  const namedSide = named("side");
  const imageSide = namedSide && !used.has(namedSide) ? namedSide : undefined;
  if (imageSide) used.add(imageSide);

  const namedBack = named("back");
  const imageBack =
    namedBack && !used.has(namedBack)
      ? namedBack
      : unique.find((url) => !used.has(url) && classifyVendorImageRole(url) !== "side");

  return { imageFront, imageSide, imageBack };
}

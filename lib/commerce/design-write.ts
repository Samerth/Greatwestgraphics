/**
 * The studio posts a `design` document. Older tabs still send
 * `artworksBySide`. Both have to reach the commerce API — dropping `design`
 * persisted an empty project that reloaded blank.
 */
export type DesignProjectClientWrite = {
  name?: string;
  garmentProductId?: string | null;
  design?: unknown;
  artworksBySide?: unknown;
  proofImageUrl?: string | null;
};

export function designProjectWriteFromBody(
  body: Record<string, unknown>,
): DesignProjectClientWrite {
  const write: DesignProjectClientWrite = {};
  if (typeof body.name === "string") write.name = body.name.trim();
  if ("garmentProductId" in body) {
    write.garmentProductId =
      typeof body.garmentProductId === "string" || body.garmentProductId === null
        ? body.garmentProductId
        : null;
  }
  if ("design" in body) write.design = body.design;
  if ("artworksBySide" in body) write.artworksBySide = body.artworksBySide;
  if ("proofImageUrl" in body) {
    write.proofImageUrl =
      typeof body.proofImageUrl === "string" || body.proofImageUrl === null
        ? body.proofImageUrl
        : null;
  }
  return write;
}

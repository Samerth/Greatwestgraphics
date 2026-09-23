import {
  ephemeralArtworkSides,
  normalizeDesignDocument,
  type DesignDocument,
  type DesignSide,
} from "@gwg/contracts";
import { decoratedDesignSides } from "@/lib/commerce/studio-placement";
import type { GarmentPhotoSet } from "@/lib/commerce/garment-backdrop";

/**
 * True when `design` is safe to freeze onto an order line as a per-colour
 * rendering source (see `CartItem.designSnapshot`): it has at least one
 * side carrying real artwork or text — a roster-only (names/numbers) design
 * has neither, and is drawn only by the flattened proof today, not by this
 * — and every artwork file link on it will still resolve after this
 * browser tab closes. A `blob:`/`data:` URL would not, which is exactly
 * what `ephemeralArtworkSides` exists to catch.
 */
export function designSnapshotIsUsable(design: DesignDocument): boolean {
  if (ephemeralArtworkSides(design).length > 0) return false;
  return decoratedDesignSides(design.artworksBySide, design.textsBySide).length > 0;
}

/** The side a per-colour thumbnail should show — the same side a flattened
 *  proof would have led with, front first. `null` when there is nothing to
 *  redraw (see `designSnapshotIsUsable`). */
export function designSnapshotHeroSide(design: DesignDocument): DesignSide | null {
  return decoratedDesignSides(design.artworksBySide, design.textsBySide)[0] ?? null;
}

function trimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Reads `configuration.designSnapshot` / `configuration.garmentPhotos` back
 * off a submitted job line — untrusted JSON from storage, not the typed
 * `CartItem` these started life as. Returns `null` whenever there isn't
 * enough to draw a real per-colour preview, so the caller falls back to
 * whatever it already rendered from the flattened proof.
 */
export function designSnapshotFromConfiguration(
  configuration: Record<string, unknown> | null | undefined,
): { design: DesignDocument; garmentPhotos: GarmentPhotoSet; heroSide: DesignSide } | null {
  if (!configuration) return null;
  const design = normalizeDesignDocument(configuration.designSnapshot);
  const heroSide = designSnapshotHeroSide(design);
  if (!heroSide) return null;

  const photosRaw = configuration.garmentPhotos;
  if (!photosRaw || typeof photosRaw !== "object") return null;
  const p = photosRaw as Record<string, unknown>;
  const garmentPhotos: GarmentPhotoSet = {
    colorFrontImageUrl: trimmedString(p.colorFrontImageUrl),
    colorBackImageUrl: trimmedString(p.colorBackImageUrl),
    colorSideImageUrl: trimmedString(p.colorSideImageUrl),
    styleImageUrl: trimmedString(p.styleImageUrl),
    styleName: trimmedString(p.styleName),
    styleTitle: trimmedString(p.styleTitle),
  };
  return { design, garmentPhotos, heroSide };
}

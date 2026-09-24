import {
  DesignSides,
  normalizeDesignDocument,
  type DesignDocument,
  type DesignSide,
} from "@gwg/contracts";
import { decoratedDesignSides } from "@/lib/commerce/studio-placement";
import type { GarmentPhotoSet } from "@/lib/commerce/garment-backdrop";

/**
 * A laxer durability check than `@gwg/contracts`' `isDurableArtworkSrc`,
 * used only for drawing a cart-line thumbnail in *this* render — not for
 * saving a design to storage, which is what that stricter check guards
 * (`assertDesignDocumentDurable`, `DesignProjectWriteSchema`).
 *
 * A signed-out visitor's artwork is deliberately held as a `data:` URL until
 * they sign in (`DesignStudio.tsx`, so a draft survives the round trip
 * through account creation), and that URL draws in a thumbnail exactly like
 * a hosted file — a `data:` URL is the image, inline. Refusing to *save* one
 * is right (bloats the row, and it should become a real hosted file once the
 * customer is signed in); refusing to *show* one meant every cart line fell
 * back to the single flattened proof and displayed the wrong colour for
 * every guest checkout (Pavin: "cart still showing wrong colors of
 * garment"). `blob:` is still refused here: it is a per-tab object handle
 * that a reload or a later render genuinely cannot resolve, unlike `data:`.
 */
function isRenderableArtworkSrc(src: string): boolean {
  const trimmed = src.trim();
  return trimmed !== "" && !/^blob:/i.test(trimmed);
}

function unrenderableArtworkSides(design: DesignDocument): DesignSide[] {
  return DesignSides.filter((side) =>
    design.artworksBySide[side].some(
      (artwork) => !isRenderableArtworkSrc(artwork.src),
    ),
  );
}

/**
 * True when `design` is safe to freeze onto an order line as a per-colour
 * rendering source (see `CartItem.designSnapshot`): it has at least one
 * side carrying real artwork or text — a roster-only (names/numbers) design
 * has neither, and is drawn only by the flattened proof today, not by this
 * — and every artwork file link on it will render in this cart, this visit
 * (`isRenderableArtworkSrc` — deliberately looser than the save-time
 * durability check, see its own comment).
 */
export function designSnapshotIsUsable(design: DesignDocument): boolean {
  if (unrenderableArtworkSides(design).length > 0) return false;
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

import { z } from "zod";

/**
 * The four garment views a customer can decorate. Sleeves are first-class
 * views rather than placement zones borrowed from the front photo: a sleeve
 * print has its own artwork, its own transform and its own proof, and
 * flattening it onto the front view lost all three the moment the customer
 * switched sides.
 */
export const DesignSides = ["front", "back", "left", "right"] as const;
export const DesignSideSchema = z.enum(DesignSides);
export type DesignSide = (typeof DesignSides)[number];

export const DESIGN_SIDE_LABELS: Record<DesignSide, string> = {
  front: "Front",
  back: "Back",
  left: "Left Sleeve",
  right: "Right Sleeve",
};

/**
 * Where on a given view the print lands. This is production intent, not
 * geometry — the artwork transform already says exactly where the layer sits,
 * but a press operator reads the zone name, so it has to survive a save.
 */
export const DESIGN_PLACEMENT_ZONES: Record<DesignSide, readonly string[]> = {
  front: ["Left Chest", "Center Chest", "Full Front"],
  back: ["Upper Back", "Full Back"],
  left: ["Left Sleeve", "Left Side Panel"],
  right: ["Right Sleeve", "Right Side Panel"],
};

export const PlacedArtworkSchema = z.object({
  id: z.string().min(1).max(200),
  src: z.string().min(1).max(4_000),
  x: z.number().finite(),
  y: z.number().finite(),
  scaleX: z.number().finite(),
  scaleY: z.number().finite(),
  rotation: z.number().finite(),
});
export type PlacedArtwork = z.infer<typeof PlacedArtworkSchema>;

/**
 * Artwork coordinates are stored in the studio's own square canvas space, so
 * any renderer that lays the garment photo out over the same square box
 * reproduces the customer's placement exactly without needing the original
 * viewport size.
 */
export const DESIGN_CANVAS_SIZE = 340;

export const DESIGN_DOCUMENT_VERSION = 2 as const;

export interface DesignDocument {
  version: typeof DESIGN_DOCUMENT_VERSION;
  artworksBySide: Record<DesignSide, PlacedArtwork[]>;
  placementBySide: Record<DesignSide, string>;
}

export function defaultPlacementBySide(): Record<DesignSide, string> {
  return {
    front: DESIGN_PLACEMENT_ZONES.front[0]!,
    back: DESIGN_PLACEMENT_ZONES.back[0]!,
    left: DESIGN_PLACEMENT_ZONES.left[0]!,
    right: DESIGN_PLACEMENT_ZONES.right[0]!,
  };
}

export function emptyDesignDocument(): DesignDocument {
  return {
    version: DESIGN_DOCUMENT_VERSION,
    artworksBySide: { front: [], back: [], left: [], right: [] },
    placementBySide: defaultPlacementBySide(),
  };
}

/**
 * How a design is spread across the `design_projects` row: the artwork map
 * keeps the column it has always had, and placements get their own column so
 * older rows read back as "no placement recorded" rather than as corrupt JSON.
 */
export interface StoredDesignDocument {
  artworksBySide: unknown;
  placementBySide?: unknown;
}

function asArtworkList(input: unknown): PlacedArtwork[] {
  if (!Array.isArray(input)) return [];
  // Lenient on read by design: one malformed layer written by an older client
  // should cost the customer that layer, not the whole saved design.
  return input.flatMap((entry) => {
    const parsed = PlacedArtworkSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function asPlacement(side: DesignSide, input: unknown): string {
  const zones = DESIGN_PLACEMENT_ZONES[side];
  return typeof input === "string" && zones.includes(input)
    ? input
    : zones[0]!;
}

/**
 * Reads any shape this table has ever held into today's document.
 *
 * Three generations exist. Rows written before sides were first-class hold a
 * bare `{ front, back, side }` artwork map with no placements at all; the
 * middle `side` bucket was whichever side photo the vendor happened to supply,
 * which in practice meant a sleeve, so it lands on `left`. Rows written by the
 * current studio hold a versioned document. Anything unrecognised degrades to
 * an empty design instead of throwing, because a read path that 500s on one
 * bad row takes the customer's whole portal down with it.
 */
export function normalizeDesignDocument(input: unknown): DesignDocument {
  if (!input || typeof input !== "object") return emptyDesignDocument();
  const record = input as Record<string, unknown>;

  const stored: StoredDesignDocument =
    "artworksBySide" in record
      ? {
          artworksBySide: record.artworksBySide,
          placementBySide: record.placementBySide,
        }
      : { artworksBySide: record };

  const artworkMap =
    stored.artworksBySide && typeof stored.artworksBySide === "object"
      ? (stored.artworksBySide as Record<string, unknown>)
      : {};
  const placementMap =
    stored.placementBySide && typeof stored.placementBySide === "object"
      ? (stored.placementBySide as Record<string, unknown>)
      : {};

  const left = [
    ...asArtworkList(artworkMap.left),
    ...asArtworkList(artworkMap.side),
  ];

  return {
    version: DESIGN_DOCUMENT_VERSION,
    artworksBySide: {
      front: asArtworkList(artworkMap.front),
      back: asArtworkList(artworkMap.back),
      left,
      right: asArtworkList(artworkMap.right),
    },
    placementBySide: {
      front: asPlacement("front", placementMap.front),
      back: asPlacement("back", placementMap.back),
      left: asPlacement("left", placementMap.left ?? placementMap.side),
      right: asPlacement("right", placementMap.right),
    },
  };
}

/** Splits a document back into the two columns it is stored in. */
export function toStoredDesignDocument(
  document: DesignDocument,
): { artworksBySide: unknown; placementBySide: unknown } {
  return {
    artworksBySide: {
      version: DESIGN_DOCUMENT_VERSION,
      ...document.artworksBySide,
    },
    placementBySide: document.placementBySide,
  };
}

export function designDocumentHasArtwork(document: DesignDocument): boolean {
  return DesignSides.some((side) => document.artworksBySide[side].length > 0);
}

/**
 * True when `src` will still resolve to the same image after the tab closes.
 *
 * `blob:` URLs are per-document handles that die with the page, and `data:`
 * URLs are not hosted assets at all — they inline the whole file into the
 * row, which is what quietly turned multi-megabyte saves into rows nobody
 * could render. Either one in a saved design means the design is lossy.
 */
export function isDurableArtworkSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  return !/^(blob:|data:)/i.test(trimmed);
}

/**
 * The wire shape for saving a design. `design` is what the current studio
 * sends; `artworksBySide` is accepted alongside it so a browser tab left open
 * across a deploy still saves something readable rather than 400ing.
 *
 * `proofImageUrl` is length-capped and durability-checked for the same reason
 * artwork is: it used to arrive as a multi-megabyte `data:` URL inlined into
 * the row, which is a hosted image only in the sense that the database was
 * hosting it.
 */
export const DesignProjectWriteSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  garmentProductId: z.string().uuid().nullable().optional(),
  design: z.unknown().optional(),
  artworksBySide: z.unknown().optional(),
  proofImageUrl: z
    .string()
    .max(2_000)
    .refine(isDurableArtworkSrc, "Proof image must be an uploaded URL")
    .nullable()
    .optional(),
});
export type DesignProjectWrite = z.infer<typeof DesignProjectWriteSchema>;

export class EphemeralArtworkError extends Error {
  readonly code = "DESIGN_ARTWORK_NOT_UPLOADED";
  constructor(readonly sides: DesignSide[]) {
    super(
      `Artwork on the ${sides
        .map((side) => DESIGN_SIDE_LABELS[side].toLowerCase())
        .join(", ")} has not finished uploading`,
    );
  }
}

/** The views holding at least one layer that would not survive a reload. */
export function ephemeralArtworkSides(document: DesignDocument): DesignSide[] {
  return DesignSides.filter((side) =>
    document.artworksBySide[side].some(
      (artwork) => !isDurableArtworkSrc(artwork.src),
    ),
  );
}

/**
 * Refuses a save that would not reload intact. This is the whole point of the
 * durability work: a design that persists object URLs looks saved, reloads
 * blank, and the customer only finds out when staff ask where the logo went.
 */
export function assertDesignDocumentDurable(document: DesignDocument): void {
  const sides = ephemeralArtworkSides(document);
  if (sides.length > 0) throw new EphemeralArtworkError(sides);
}

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
 * Named slot on a view. The artwork transform is the exact geometry; this
 * string is what a press operator reads. The studio still uses it to default
 * a new upload (Center Chest on the front) inside the print area. It has to
 * survive a save even though the customer no longer picks a zone in the UI.
 */
export const DESIGN_PLACEMENT_ZONES: Record<DesignSide, readonly string[]> = {
  front: ["Left Chest", "Center Chest", "Right Chest", "Full Front"],
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
  outline: z.boolean().optional(),
  outlineColor: z.string().max(40).optional(),
  zIndex: z.number().finite().optional(),
});
export type PlacedArtwork = z.infer<typeof PlacedArtworkSchema>;

export const TextAligns = ["left", "center", "right"] as const;
export const TextAlignSchema = z.enum(TextAligns);
export type TextAlign = (typeof TextAligns)[number];

/** Per-text decoration. Independent of the garment-level cart print method. */
export const TextPrintMethods = ["print", "embroidery"] as const;
export const TextPrintMethodSchema = z.enum(TextPrintMethods);
export type TextPrintMethod = (typeof TextPrintMethods)[number];

export const PlacedTextSchema = z.object({
  id: z.string().min(1).max(200),
  text: z.string().max(500),
  x: z.number().finite(),
  y: z.number().finite(),
  scaleX: z.number().finite(),
  scaleY: z.number().finite(),
  rotation: z.number().finite(),
  /** Studio font id from `STUDIO_FONTS`, not a raw CSS stack. */
  fontFamily: z.string().min(1).max(80),
  fontSize: z.number().finite().min(6).max(200),
  fill: z.string().min(1).max(40),
  align: TextAlignSchema,
  printMethod: TextPrintMethodSchema,
  letterSpacing: z.number().finite().min(-20).max(80).optional(),
  /** Degrees of curvature. 0 is straight; positive arcs up. */
  arc: z.number().finite().min(-180).max(180).optional(),
  outline: z.boolean().optional(),
  outlineColor: z.string().max(40).optional(),
  outlineWidth: z.number().finite().min(0).max(20).optional(),
  zIndex: z.number().finite().optional(),
});
export type PlacedText = z.infer<typeof PlacedTextSchema>;

export const RosterDecorPartSchema = z.object({
  printMethod: TextPrintMethodSchema,
  heightIn: z.number().finite().min(0.25).max(12),
  color: z.string().min(1).max(40),
  location: z.string().min(1).max(80),
});
export type RosterDecorPart = z.infer<typeof RosterDecorPartSchema>;

export const RosterDecorSchema = z.object({
  names: RosterDecorPartSchema,
  numbers: RosterDecorPartSchema,
});
export type RosterDecor = z.infer<typeof RosterDecorSchema>;

export const DesignRosterRowSchema = z.object({
  size: z.string().max(40),
  name: z.string().max(80),
  number: z.string().max(20).optional(),
});
export type DesignRosterRow = z.infer<typeof DesignRosterRowSchema>;

export function defaultRosterDecor(): RosterDecor {
  return {
    names: {
      printMethod: "print",
      heightIn: 2.5,
      color: "#111111",
      location: "Upper Back",
    },
    numbers: {
      printMethod: "print",
      heightIn: 8,
      color: "#111111",
      location: "Full Back",
    },
  };
}

export function emptyTextsBySide(): Record<DesignSide, PlacedText[]> {
  return { front: [], back: [], left: [], right: [] };
}

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
  /** Optional on the wire; `normalizeDesignDocument` always fills this. */
  textsBySide: Record<DesignSide, PlacedText[]>;
  notes: string;
  rosterDecor: RosterDecor;
  roster?: DesignRosterRow[];
}

export function defaultPlacementBySide(): Record<DesignSide, string> {
  return {
    front: "Center Chest",
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
    textsBySide: emptyTextsBySide(),
    notes: "",
    rosterDecor: defaultRosterDecor(),
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
  textsBySide?: unknown;
  notes?: unknown;
  rosterDecor?: unknown;
  roster?: unknown;
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

function asTextList(input: unknown): PlacedText[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    const parsed = PlacedTextSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function asTextsBySide(input: unknown): Record<DesignSide, PlacedText[]> {
  const map = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    front: asTextList(map.front),
    back: asTextList(map.back),
    left: [...asTextList(map.left), ...asTextList(map.side)],
    right: asTextList(map.right),
  };
}

function asNotes(input: unknown): string {
  return typeof input === "string" ? input.slice(0, 4_000) : "";
}

function asRosterDecor(input: unknown): RosterDecor {
  const parsed = RosterDecorSchema.safeParse(input);
  return parsed.success ? parsed.data : defaultRosterDecor();
}

function asRoster(input: unknown): DesignRosterRow[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const rows = input.flatMap((entry) => {
    const parsed = DesignRosterRowSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
  return rows.length > 0 ? rows : undefined;
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
          textsBySide: record.textsBySide,
          notes: record.notes,
          rosterDecor: record.rosterDecor,
          roster: record.roster,
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

  const textsBySide = asTextsBySide(
    stored.textsBySide ?? artworkMap.textsBySide,
  );
  const notes = asNotes(stored.notes ?? artworkMap.notes);
  const rosterDecor = asRosterDecor(
    stored.rosterDecor ?? artworkMap.rosterDecor,
  );
  const roster = asRoster(stored.roster ?? artworkMap.roster);

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
    textsBySide,
    notes,
    rosterDecor,
    ...(roster ? { roster } : {}),
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
      textsBySide: document.textsBySide,
      notes: document.notes,
      rosterDecor: document.rosterDecor,
      ...(document.roster && document.roster.length > 0
        ? { roster: document.roster }
        : {}),
    },
    placementBySide: document.placementBySide,
  };
}

export function designDocumentHasArtwork(document: DesignDocument): boolean {
  return DesignSides.some(
    (side) =>
      document.artworksBySide[side].length > 0 ||
      (document.textsBySide?.[side]?.length ?? 0) > 0,
  );
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

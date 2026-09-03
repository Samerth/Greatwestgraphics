import { rosterWeightedCostMinor } from "../utils/shopper-price";

/** One size within a colour block: the variant the customer would actually
 *  order, plus how many of it they want. */
export interface ColourMatrixSize {
  variantId: string;
  sizeName: string;
  unitCostMinor: number | null;
  mapPriceMinor: number | null;
  inStock: boolean;
  quantity: number;
}

/** One garment colour being ordered, with its own size breakdown. The client
 *  asked for exactly this shape: "add additional garment colours and enter a
 *  separate size breakdown for each colour". */
export interface ColourMatrixBlock {
  productId: string;
  colorName: string;
  imageUrl: string | null;
  hex: string | null;
  sizes: ColourMatrixSize[];
}

export function blockQuantity(block: ColourMatrixBlock): number {
  return block.sizes.reduce((sum, size) => sum + Math.max(0, size.quantity), 0);
}

export function matrixTotalQuantity(blocks: ColourMatrixBlock[]): number {
  return blocks.reduce((sum, block) => sum + blockQuantity(block), 0);
}

/** Every (colour, size) line the customer has actually entered a quantity
 *  against. Blocks with nothing entered are not part of the order. */
export function matrixOrderedLines(
  blocks: ColourMatrixBlock[],
): { block: ColourMatrixBlock; size: ColourMatrixSize }[] {
  const lines: { block: ColourMatrixBlock; size: ColourMatrixSize }[] = [];
  for (const block of blocks) {
    for (const size of block.sizes) {
      if (size.quantity > 0) lines.push({ block, size });
    }
  }
  return lines;
}

/**
 * Adds two sets of colour blocks together, size by size.
 *
 * A team order is commonly "one shirt per named player, plus a few spares" —
 * the named pieces come from the roster and the spares from the plain size
 * grid, and both are the same garment in the same run. Summing them here
 * means the run is priced once, at its true total quantity, so the spares
 * count toward the volume break instead of being quoted as a separate
 * small order.
 *
 * Blocks are matched on `productId`; a colour present in only one side is
 * carried through as-is.
 */
export function mergeMatrixBlocks(
  a: ColourMatrixBlock[],
  b: ColourMatrixBlock[],
): ColourMatrixBlock[] {
  const merged = new Map<string, ColourMatrixBlock>();

  for (const block of [...a, ...b]) {
    const existing = merged.get(block.productId);
    if (!existing) {
      merged.set(block.productId, {
        ...block,
        sizes: block.sizes.map((size) => ({ ...size })),
      });
      continue;
    }
    for (const size of block.sizes) {
      const target = existing.sizes.find(
        (candidate) => candidate.variantId === size.variantId,
      );
      if (target) {
        target.quantity += size.quantity;
      } else {
        existing.sizes.push({ ...size });
      }
    }
  }

  return [...merged.values()];
}

export interface MatrixCost {
  unitCostMinor: number;
  mapPriceMinor: number | null;
  quantity: number;
  /** False when no entered line matched a real variant cost, meaning the
   *  fallback carried the whole estimate — the caller should treat the
   *  resulting price as indicative rather than firm. */
  matched: boolean;
}

/**
 * Blended garment cost across every colour and size being ordered.
 *
 * Deliberately layered on `rosterWeightedCostMinor` rather than re-deriving
 * an average here: that function is the existing, tested rule for "what does
 * a mixed-size run cost per piece", including how it falls back and how it
 * lifts the MAP floor. This applies that rule within each colour (where the
 * variant list is the one that actually belongs to that colour) and then
 * composes the results across colours, weighted by quantity.
 *
 * Costs can differ per colourway — a vendor commonly charges more for
 * heathers than for white — so blending every colour against a single
 * variant list would quietly misprice a mixed-colour order.
 */
export function matrixWeightedCost(
  blocks: ColourMatrixBlock[],
  fallback: { unitCostMinor: number; mapPriceMinor?: number | null },
): MatrixCost {
  let costTotal = 0;
  let quantity = 0;
  let mapFloor: number | null = fallback.mapPriceMinor ?? null;
  let matched = false;

  for (const block of blocks) {
    const qty = blockQuantity(block);
    if (qty <= 0) continue;

    // One row per garment, so a run of 20 Large and 4 Small weights Large
    // five times as heavily — the same thing the roster rule does.
    const rows: { size: string }[] = [];
    for (const size of block.sizes) {
      for (let i = 0; i < Math.max(0, size.quantity); i += 1) {
        rows.push({ size: size.sizeName });
      }
    }

    const blockCost = rosterWeightedCostMinor(
      rows,
      block.sizes.map((size) => ({
        sizeName: size.sizeName,
        unitCostMinor: size.unitCostMinor,
        mapPriceMinor: size.mapPriceMinor,
      })),
      fallback,
    );

    if (blockCost.matched) matched = true;
    if (blockCost.mapPriceMinor != null) {
      mapFloor = Math.max(mapFloor ?? 0, blockCost.mapPriceMinor);
    }
    costTotal += blockCost.unitCostMinor * qty;
    quantity += qty;
  }

  if (quantity === 0) {
    return {
      unitCostMinor: fallback.unitCostMinor,
      mapPriceMinor: fallback.mapPriceMinor ?? null,
      quantity: 0,
      matched: false,
    };
  }

  return {
    unitCostMinor: Math.round(costTotal / quantity),
    mapPriceMinor: mapFloor,
    quantity,
    matched,
  };
}

/**
 * Which sizes still have no quantity against them anywhere in the order.
 * Used to warn before checkout rather than to block it — a customer
 * ordering only Large is perfectly valid.
 */
export function matrixIsEmpty(blocks: ColourMatrixBlock[]): boolean {
  return matrixTotalQuantity(blocks) === 0;
}

/**
 * Colours the customer has entered a quantity for but which contain an
 * out-of-stock size. Surfaced as a warning so nobody discovers it at
 * checkout, after they have already committed to a design.
 */
export function matrixOutOfStockLines(
  blocks: ColourMatrixBlock[],
): { colorName: string; sizeName: string }[] {
  return matrixOrderedLines(blocks)
    .filter(({ size }) => !size.inStock)
    .map(({ block, size }) => ({
      colorName: block.colorName,
      sizeName: size.sizeName,
    }));
}

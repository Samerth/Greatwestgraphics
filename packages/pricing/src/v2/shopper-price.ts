import type {
  LinePricingSnapshotV2,
  PricingConfigV2,
  QuoteBreakdownV2,
  QuoteInputV2,
} from "@gwg/contracts";
import { calculateQuoteV2 } from "./calculate-quote.js";
import { garmentPriceCurve, priceGarmentFromCurve } from "./garment-price.js";
import { roundMinor } from "./interpolate.js";

export type ShopperPriceInput = {
  unitCostMinor: number;
  quantity: number;
  mapPriceMinor?: number | null;
  colourName?: string;
  isDark?: boolean;
  methodKey?: string;
  colours?: number;
  stitchCount?: number;
  optionKey?: string;
  /** Print locations. Defaults to the storefront default location. */
  locations?: string[];
  /**
   * One design across every placement shares a single setup fee. Studio
   * artwork on two sides is usually two designs, so it leaves this false.
   */
  shareSetup?: boolean;
  rush?: boolean;
  includePacking?: boolean;
  /** Customer checked "Individual names/numbers" on the PDP or quote builder. */
  includeNamesNumbers?: boolean;
  shippingCostMinor?: number;
  description?: string;
  /**
   * Force a decorated quote even when the storefront unit-price strategy is
   * "blank". The quote builder and design studio always decorate.
   */
  decorated?: boolean;
};

export type ShopperPriceSummary = {
  costMinor: number;
  markup: number;
  garmentMinor: number;
  decorationMinor: number;
  setupMinor: number;
  threadMinor: number;
  quantity: number;
  mapPriceMinor: number | null;
  mapApplied: boolean;
  unitMinor: number;
  totalMinor: number;
};

export type ShopperQuoteResult = {
  input: QuoteInputV2;
  breakdown: QuoteBreakdownV2;
  /** Full engine total — same number admin preview shows for this input. */
  totalMinor: number;
  /** Garment + run + per-piece charges, setup left off. */
  perPieceMinor: number;
  /**
   * Dollars so `qty * unit` equals the engine total. Carts store dollars.
   */
  cartUnit: number;
  snapshot: LinePricingSnapshotV2;
};

const FALLBACK_STOREFRONT = {
  unitPriceIncludes: "blank" as const,
  defaultMethodKey: "screenPrint",
  defaultLocation: "front",
  defaultColours: 1,
  defaultStitchCount: 5000,
  defaultOptionKey: "medium",
  assumeNewArtwork: true,
  assumeDarkGarment: false,
};

function storefrontOf(config: PricingConfigV2) {
  return config.storefront ?? FALLBACK_STOREFRONT;
}

function methodFor(
  config: PricingConfigV2,
  key: string | undefined,
  defaultKey: string,
): PricingConfigV2["methods"][number] | undefined {
  if (key) {
    const match = config.methods.find((method) => method.key === key && method.enabled);
    if (match) return match;
  }
  const fallback = config.methods.find(
    (method) => method.key === defaultKey && method.enabled,
  );
  return fallback ?? config.methods.find((method) => method.enabled);
}

function decorationFields(
  method: PricingConfigV2["methods"][number],
  input: ShopperPriceInput,
  storefront: ReturnType<typeof storefrontOf>,
) {
  return {
    colours:
      method.rateModel.kind === "matrixByColour"
        ? input.colours ?? storefront.defaultColours
        : undefined,
    variableValue:
      method.rateModel.kind === "baseWithVariable"
        ? input.stitchCount ?? storefront.defaultStitchCount
        : undefined,
    optionKey:
      method.rateModel.kind === "matrixByOption"
        ? input.optionKey ?? storefront.defaultOptionKey
        : undefined,
  };
}

/**
 * Build the quote the storefront strategy would run: same engine as admin.
 */
export function buildShopperQuoteInput(
  config: PricingConfigV2,
  input: ShopperPriceInput,
): QuoteInputV2 {
  const quantity = Math.max(1, Math.round(input.quantity));
  const storefront = storefrontOf(config);
  const includeDecoration =
    input.decorated === true || storefront.unitPriceIncludes !== "blank";
  const method = includeDecoration
    ? methodFor(config, input.methodKey, storefront.defaultMethodKey)
    : undefined;

  const locations =
    input.locations && input.locations.length > 0
      ? input.locations
      : [storefront.defaultLocation];

  const decorations: QuoteInputV2["decorations"] = [];
  if (method) {
    const fields = decorationFields(method, input, storefront);
    const artwork = {
      isRepeat: !storefront.assumeNewArtwork,
      verifiedByStaff: !storefront.assumeNewArtwork,
    };
    for (const location of locations) {
      decorations.push({
        id: locations.length === 1 ? "shopper" : `decoration-${location}`,
        garmentId: "shopper",
        methodKey: method.key,
        location,
        logoGroup: input.shareSetup ? "primary" : "",
        ...fields,
        isOversized: false,
        artwork,
      });
    }
  }

  return {
    garments: [
      {
        id: "shopper",
        description: input.description ?? "Shopper price",
        unitCostMinor: input.unitCostMinor,
        quantity,
        colourName: input.colourName ?? "",
        isDark: input.isDark ?? (storefront.assumeDarkGarment ? true : undefined),
        mapPriceMinor: input.mapPriceMinor ?? undefined,
      },
    ],
    decorations,
    options: {
      rush: input.rush ?? false,
      includePacking: input.includePacking ?? false,
      namesNumbers: input.includeNamesNumbers ?? false,
      shippingCostMinor: input.shippingCostMinor ?? 0,
      designHours: 0,
    },
  };
}

export function summarizeShopperPrice(
  config: PricingConfigV2,
  breakdown: QuoteBreakdownV2,
  input: ShopperPriceInput,
): ShopperPriceSummary {
  const quantity = Math.max(1, breakdown.totalQuantity);
  const garmentLine = breakdown.lines.find((line) => line.kind === "garment");
  const garmentMinor = garmentLine?.extendedAmountMinor ?? 0;
  const decorationMinor = breakdown.lines
    .filter((line) => line.kind === "decoration" || line.kind === "surcharge")
    .reduce((sum, line) => sum + line.extendedAmountMinor, 0);
  const setupMinor = breakdown.totals.setupMinor;
  const threadMinor = breakdown.totals.threadMinor ?? 0;
  const perPieceThread = breakdown.lines
    .filter((line) => line.kind === "thread" && line.quantity > 1)
    .reduce((sum, line) => sum + line.extendedAmountMinor, 0);

  const curve = garmentPriceCurve(config, input.unitCostMinor);
  const priced = priceGarmentFromCurve(curve, {
    unitCostMinor: input.unitCostMinor,
    quantity,
    mapPriceMinor: input.mapPriceMinor ?? null,
  });

  const includes = config.storefront?.unitPriceIncludes ?? "blank";
  let totalMinor: number;
  if (includes === "blank") {
    totalMinor = garmentMinor;
  } else if (includes === "decorated") {
    totalMinor = garmentMinor + decorationMinor + perPieceThread;
  } else {
    totalMinor = garmentMinor + decorationMinor + setupMinor + threadMinor;
  }

  return {
    costMinor: input.unitCostMinor,
    markup: priced.markup,
    garmentMinor,
    decorationMinor,
    setupMinor,
    threadMinor,
    quantity,
    mapPriceMinor: input.mapPriceMinor ?? null,
    mapApplied: priced.mapFloorApplied,
    unitMinor: roundMinor(totalMinor / quantity),
    totalMinor,
  };
}

/**
 * Shopper-facing price from the published config. Admin preview uses the
 * same function so the number a customer sees is the number staff just set.
 */
export function priceShopperItem(
  config: PricingConfigV2,
  input: ShopperPriceInput,
): { summary: ShopperPriceSummary; breakdown: QuoteBreakdownV2 } {
  const quote = buildShopperQuoteInput(config, input);
  const breakdown = calculateQuoteV2(quote, config);
  return {
    summary: summarizeShopperPrice(config, breakdown, input),
    breakdown,
  };
}

/**
 * Full decorated quote for the quote builder and design studio. Always
 * runs `calculateQuoteV2`, so the total matches admin preview for the
 * same inputs.
 */
export function priceShopperQuote(
  config: PricingConfigV2,
  input: ShopperPriceInput,
): ShopperQuoteResult {
  const quoteInput = buildShopperQuoteInput(config, { ...input, decorated: true });
  const breakdown = calculateQuoteV2(quoteInput, config);
  const quantity = Math.max(1, breakdown.totalQuantity);
  return {
    input: quoteInput,
    breakdown,
    totalMinor: breakdown.totals.totalMinor,
    perPieceMinor: breakdown.garments[0]?.unitPriceMinor ?? 0,
    cartUnit: breakdown.totals.totalMinor / 100 / quantity,
    snapshot: {
      schemaVersion: 2,
      input: quoteInput,
      breakdown,
      pricingConfigVersion: config.version,
    },
  };
}

/** One decoration location's own method + pricing input, for a quote that
 * decorates more than one location with different methods. */
export type ShopperDecorationInput = {
  location: string;
  methodKey: string;
  colours?: number;
  stitchCount?: number;
  optionKey?: string;
};

export type ShopperMultiPriceInput = Omit<
  ShopperPriceInput,
  "methodKey" | "colours" | "stitchCount" | "optionKey" | "locations"
> & {
  /** One entry per decorated location, each priced through its own method —
   * unlike `ShopperPriceInput.locations`, which applies a single method
   * everywhere (CodSphere UAT: "a customer could select Screen Print → Front
   * → 3 Colours for one logo and Embroidery → Left Chest → Small for
   * another"). Each entry names the method it wants explicitly, so — unlike
   * `buildShopperQuoteInput`, which is allowed to fall back to the
   * storefront default — a location whose `methodKey` does not match a real
   * enabled method is dropped rather than silently priced under some other
   * method the customer never chose. */
  decorations: ShopperDecorationInput[];
};

export function buildShopperQuoteInputMulti(
  config: PricingConfigV2,
  input: ShopperMultiPriceInput,
): QuoteInputV2 {
  const quantity = Math.max(1, Math.round(input.quantity));
  const storefront = storefrontOf(config);

  const decorations: QuoteInputV2["decorations"] = [];
  for (const line of input.decorations) {
    // No fallback-to-default here (unlike `methodFor`): this is an explicit
    // per-location choice, so an unrecognized key means "skip it", not
    // "price it as something else instead."
    const method = config.methods.find(
      (candidate) => candidate.key === line.methodKey && candidate.enabled,
    );
    if (!method) continue;
    const fields = decorationFields(
      method,
      {
        unitCostMinor: input.unitCostMinor,
        quantity: input.quantity,
        colours: line.colours,
        stitchCount: line.stitchCount,
        optionKey: line.optionKey,
      },
      storefront,
    );
    decorations.push({
      id: `decoration-${line.location}`,
      garmentId: "shopper",
      methodKey: method.key,
      location: line.location,
      logoGroup: input.shareSetup ? "primary" : "",
      ...fields,
      isOversized: false,
      artwork: {
        isRepeat: !storefront.assumeNewArtwork,
        verifiedByStaff: !storefront.assumeNewArtwork,
      },
    });
  }

  return {
    garments: [
      {
        id: "shopper",
        description: input.description ?? "Shopper price",
        unitCostMinor: input.unitCostMinor,
        quantity,
        colourName: input.colourName ?? "",
        isDark: input.isDark ?? (storefront.assumeDarkGarment ? true : undefined),
        mapPriceMinor: input.mapPriceMinor ?? undefined,
      },
    ],
    decorations,
    options: {
      rush: input.rush ?? false,
      includePacking: input.includePacking ?? false,
      namesNumbers: input.includeNamesNumbers ?? false,
      shippingCostMinor: input.shippingCostMinor ?? 0,
      designHours: 0,
    },
  };
}

/**
 * Same contract as `priceShopperQuote`, but each decorated location is
 * priced through its own method instead of one method applied everywhere —
 * what the Design Studio needs once a customer runs, say, Screen Print on
 * the front and Embroidery on a sleeve in the same design.
 */
export function priceShopperQuoteMulti(
  config: PricingConfigV2,
  input: ShopperMultiPriceInput,
): ShopperQuoteResult {
  const quoteInput = buildShopperQuoteInputMulti(config, { ...input, decorated: true });
  const breakdown = calculateQuoteV2(quoteInput, config);
  const quantity = Math.max(1, breakdown.totalQuantity);
  return {
    input: quoteInput,
    breakdown,
    totalMinor: breakdown.totals.totalMinor,
    perPieceMinor: breakdown.garments[0]?.unitPriceMinor ?? 0,
    cartUnit: breakdown.totals.totalMinor / 100 / quantity,
    snapshot: {
      schemaVersion: 2,
      input: quoteInput,
      breakdown,
      pricingConfigVersion: config.version,
    },
  };
}

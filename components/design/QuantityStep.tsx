"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PricingConfigV2, SideDecoration } from "@gwg/contracts";
import {
  DESIGN_SIDE_LABELS,
  defaultRosterDecor,
  designDocumentHasArtwork,
  type DesignSide,
} from "@gwg/contracts";
import { priceShopperQuoteMulti } from "@gwg/pricing";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { decoratedDesignSides } from "@/lib/commerce/studio-placement";
import { decorationLinesForPricing } from "@/lib/commerce/studio-decoration";
import { rosterActiveSides } from "@/lib/commerce/studio-roster-preview";
import { useActiveDesignStore } from "@/lib/store/active-design";
import { useDesignOrderStore } from "@/lib/store/design-order";
import { useCartStore } from "@/lib/store/cart";
import { trackCartItemAdded } from "@/lib/analytics/gtag";
import {
  matrixIsEmpty,
  matrixOrderedLines,
  matrixOutOfStockLines,
  matrixTotalQuantity,
  matrixWeightedCost,
  mergeMatrixBlocks,
  blockQuantity,
  type ColourMatrixBlock,
} from "@/lib/commerce/design-colour-matrix";
import { OptionalImage } from "@/components/shared/OptionalImage";
import { DesignPreviewViewer } from "@/components/design/DesignPreviewViewer";
import { DesignStepBar } from "@/components/design/DesignStepBar";
import { cn } from "@/lib/utils/cn";

type Variant = {
  id: string;
  sizeName: string;
  qty: number;
  active?: boolean;
  customerPriceMinor?: number | null;
  mapPriceMinor?: number | null;
};

type Colorway = {
  id: string;
  colorName: string;
  colorHex?: string | null;
  swatchImageUrl?: string | null;
  frontImageUrl?: string | null;
};

type Detail = {
  product: {
    id: string;
    slug?: string;
    colorName: string;
    colorFrontImageUrl: string | null;
    colorSideImageUrl: string | null;
    colorBackImageUrl: string | null;
    isDark?: boolean;
  };
  style: { id: string; brandName: string; styleName: string; title?: string | null };
  variants: Variant[];
  colorways?: Colorway[];
};

async function fetchDetail(productId: string): Promise<Detail | null> {
  try {
    const res = await fetch(`/api/commerce/catalog/products/${productId}`);
    if (!res.ok) return null;
    return (await res.json()) as Detail;
  } catch {
    return null;
  }
}

function blockFromDetail(detail: Detail): ColourMatrixBlock {
  return {
    productId: detail.product.id,
    colorName: detail.product.colorName,
    imageUrl: detail.product.colorFrontImageUrl,
    hex: null,
    sizes: detail.variants.map((v) => ({
      variantId: v.id,
      sizeName: v.sizeName,
      unitCostMinor: v.customerPriceMinor ?? null,
      mapPriceMinor: v.mapPriceMinor ?? null,
      inStock: v.qty > 0 && v.active !== false,
      quantity: 0,
    })),
  };
}

export function QuantityStep({
  pricingConfig,
}: {
  pricingConfig: PricingConfigV2 | null;
}) {
  // Persisted stores hydrate after the first paint; rendering their contents
  // before that produces a server/client mismatch, so hold the skeleton until
  // we know what the browser actually has.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const design = useActiveDesignStore((s) => s.design);
  const designName = useActiveDesignStore((s) => s.name);
  const garmentProductId = useDesignOrderStore((s) => s.garmentProductId);
  const decoration = useDesignOrderStore((s) => s.decoration);
  const setReachedQuantity = useDesignOrderStore((s) => s.setReachedQuantity);
  const names = useDesignOrderStore((s) => s.names);
  const proofUrl = useDesignOrderStore((s) => s.proofUrl);
  const designProjectId = useDesignOrderStore((s) => s.designProjectId);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const [detail, setDetail] = useState<Detail | null>(null);
  // Cart lines need the slug and style of the colour they belong to, which
  // the pricing model deliberately does not carry. Kept beside it rather
  // than inside it so `design-colour-matrix` stays purely about money.
  const [detailsById, setDetailsById] = useState<Record<string, Detail>>({});
  const [blocks, setBlocks] = useState<ColourMatrixBlock[]>([]);
  // One entry per named person, in the same order the studio captured them:
  // which colour they take and in what size. Sizes are deliberately blank to
  // start — an unanswered size must read as unanswered, not silently default
  // to Small and ship the wrong garment.
  const [assignments, setAssignments] = useState<
    { productId: string; sizeName: string }[]
  >([]);
  const [adding, setAdding] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingColour, setAddingColour] = useState(false);
  const [pendingColourId, setPendingColourId] = useState<string | null>(null);

  const hasDesign = mounted && designDocumentHasArtwork(design);

  useEffect(() => {
    if (!mounted || !garmentProductId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDetail(garmentProductId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setBlocks(d ? [blockFromDetail(d)] : []);
      if (d) setDetailsById((prev) => ({ ...prev, [d.product.id]: d }));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, garmentProductId]);

  useEffect(() => {
    if (hasDesign) setReachedQuantity(true);
  }, [hasDesign, setReachedQuantity]);

  // A names-only design (no separate artwork) is still fully decorated —
  // matches the same rule the studio's Continue button uses, so a design
  // that was allowed to leave the studio is never re-judged as "nothing to
  // price" here.
  const decoratedSides = useMemo(
    () =>
      decoratedDesignSides(
        design.artworksBySide,
        design.textsBySide,
        rosterActiveSides(
          design.rosterDecor ?? defaultRosterDecor(),
          names.length > 0,
        ),
      ),
    [design, names],
  );

  // Seed one assignment per named person once the garment is known. Keyed
  // off length so re-renders do not wipe choices already made.
  useEffect(() => {
    if (!garmentProductId || names.length === 0) return;
    setAssignments((prev) =>
      prev.length === names.length
        ? prev
        : names.map(
            (_, i) => prev[i] ?? { productId: garmentProductId, sizeName: "" },
          ),
    );
  }, [names, garmentProductId]);

  const rosterMode = names.length > 0;

  /**
   * The roster expressed as colour blocks, so a named team order prices
   * through exactly the same path as a plain size-and-quantity one — one
   * tested cost rule, not two that can drift apart.
   */
  const rosterBlocks = useMemo<ColourMatrixBlock[]>(() => {
    if (!rosterMode) return [];
    const byProduct = new Map<string, ColourMatrixBlock>();
    for (const a of assignments) {
      if (!a.sizeName) continue;
      const d = detailsById[a.productId];
      if (!d) continue;
      if (!byProduct.has(a.productId)) {
        byProduct.set(a.productId, blockFromDetail(d));
      }
      const block = byProduct.get(a.productId)!;
      const size = block.sizes.find((x) => x.sizeName === a.sizeName);
      if (size) size.quantity += 1;
    }
    return [...byProduct.values()];
  }, [rosterMode, assignments, detailsById]);

  // Named pieces and un-named spares are the same run of the same garment,
  // so they are summed rather than treated as alternatives: a team ordering
  // 12 named jerseys plus 3 blanks is a run of 15 and must be priced at 15.
  // Everything downstream — totals, pricing, stock warnings, the cart —
  // reads this.
  const activeBlocks = useMemo(
    () => (rosterMode ? mergeMatrixBlocks(rosterBlocks, blocks) : blocks),
    [rosterMode, rosterBlocks, blocks],
  );

  const totalQty = matrixTotalQuantity(activeBlocks);
  const outOfStock = matrixOutOfStockLines(activeBlocks);
  const unsizedCount = rosterMode
    ? assignments.filter((a) => !a.sizeName).length
    : 0;
  const namedQty = matrixTotalQuantity(rosterBlocks);
  const spareQty = matrixTotalQuantity(blocks);

  // Fallback for any decorated side the customer never explicitly set a
  // method for (they only opened the studio's decoration picker for one of
  // several sides, say) — the same studio-wide default that used to be the
  // only decoration value that existed.
  const fallbackDecoration: SideDecoration = {
    methodKey: decoration.methodKey || pricingConfig?.storefront?.defaultMethodKey || "screenPrint",
    colours: decoration.colours ?? undefined,
    stitchPreset: decoration.stitchPreset || undefined,
    optionKey: decoration.optionKey || undefined,
  };

  // One line per decorated side, each priced through whichever method the
  // customer picked for that side specifically (CodSphere UAT — Screen
  // Print on the front and Embroidery on a sleeve in the same design price
  // independently, not under one method for everywhere).
  const decorationLines = useMemo(
    () => decorationLinesForPricing(design, decoratedSides, fallbackDecoration),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [design, decoratedSides, decoration],
  );

  // The customer chose these in the studio; show their real labels on the
  // cart line rather than the internal keys. Every distinct method used
  // across the decorated sides, not just one — a design that mixes Screen
  // Print and Embroidery should say so.
  const methodLabel = useMemo(() => {
    const labels = [
      ...new Set(
        decorationLines.map(
          (line) =>
            pricingConfig?.methods.find((m) => m.key === line.methodKey)?.label ??
            line.methodKey,
        ),
      ),
    ];
    return labels.length > 0 ? labels.join(" + ") : "Custom decoration";
  }, [decorationLines, pricingConfig]);
  const namesFeeMinor =
    pricingConfig?.settings?.namesNumbersFeePerGarmentMinor ?? 0;

  const quote = useMemo(() => {
    if (!pricingConfig || activeBlocks.length === 0 || totalQty === 0) return null;
    const cost = matrixWeightedCost(activeBlocks, {
      unitCostMinor: 0,
      mapPriceMinor: null,
    });
    if (cost.unitCostMinor <= 0) return null;
    try {
      return priceShopperQuoteMulti(pricingConfig, {
        unitCostMinor: cost.unitCostMinor,
        quantity: cost.quantity,
        mapPriceMinor: cost.mapPriceMinor,
        colourName: activeBlocks[0]?.colorName ?? "",
        isDark: detail?.product.isDark,
        decorations: decorationLines,
        shareSetup: false,
        description: designName || "Custom design",
        // The engine applies the names/numbers fee across the whole quote's
        // quantity, all-or-nothing. That is exactly right when every piece is
        // named, and wrong when the order also contains un-named spares —
        // those would be charged for a personalisation they do not get. So
        // it is only switched on for a fully-named order; a mixed one is
        // flagged to the customer instead of being silently over-charged.
        includeNamesNumbers: namedQty > 0 && spareQty === 0,
      });
    } catch (caught) {
      // Same rule as the studio: never fall back to a blank-garment price
      // silently, or an order reaches checkout under-priced.
      console.error("[pricing] quantity step quote failed", caught);
      return null;
    }
  }, [
    pricingConfig,
    activeBlocks,
    totalQty,
    detail,
    decorationLines,
    designName,
    namedQty,
    spareQty,
  ]);

  function setSizeQty(productId: string, variantId: string, next: number) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.productId !== productId
          ? block
          : {
              ...block,
              sizes: block.sizes.map((size) =>
                size.variantId === variantId
                  ? { ...size, quantity: Math.max(0, next) }
                  : size,
              ),
            },
      ),
    );
  }

  async function addColour(colourId: string) {
    setPendingColourId(colourId);
    const d = await fetchDetail(colourId);
    setPendingColourId(null);
    if (!d) return;
    setDetailsById((prev) => ({ ...prev, [d.product.id]: d }));
    setBlocks((prev) =>
      prev.some((b) => b.productId === d.product.id)
        ? prev
        : [...prev, blockFromDetail(d)],
    );
    setAddingColour(false);
  }

  function removeColour(productId: string) {
    setBlocks((prev) => prev.filter((b) => b.productId !== productId));
  }

  /**
   * One cart line per colour and size, because that is what a variant is —
   * a single line covering "48 pieces, mixed" would give the warehouse
   * nothing to pick against.
   *
   * Every line carries the same per-piece price and pricing snapshot: the
   * quote was computed for the run as a whole, so splitting it into lines
   * must not re-price each line at its own smaller quantity, or a 200-piece
   * order would silently checkout at 12-piece rates.
   */
  function addToCart() {
    if (!quote || matrixIsEmpty(activeBlocks)) return;
    if (rosterMode && unsizedCount > 0 && namedQty > 0) {
      setCartError(
        `Choose a size for ${unsizedCount} more ${unsizedCount === 1 ? "person" : "people"} before continuing.`,
      );
      return;
    }
    setCartError(null);
    setAdding(true);
    try {
      const lines = matrixOrderedLines(activeBlocks);
      if (!proofUrl && !designProjectId) {
        setCartError(
          "Your artwork did not travel with the design. Go back to the Design Studio and click Continue to Quantity again.",
        );
        return;
      }

      if (rosterMode) {
        // One line per colour, carrying that colour's people. The cart
        // treats `roster.length` as the quantity, so the sizes live on the
        // rows rather than being collapsed into a single size field.
        const byColour = new Map<string, { size: string; name: string; number?: string }[]>();
        names.forEach((person, i) => {
          const a = assignments[i];
          if (!a?.sizeName) return;
          const rows = byColour.get(a.productId) ?? [];
          rows.push({
            size: a.sizeName,
            name: person.name,
            ...(person.number ? { number: person.number } : {}),
          });
          byColour.set(a.productId, rows);
        });
        for (const [productId, rows] of byColour) {
          const d = detailsById[productId];
          const productName = d
            ? `${d.style.brandName} ${d.style.styleName}`.trim()
            : "Custom design";
          addItem({
            id: `${productId}:roster`,
            productId,
            productSlug: d?.product.slug,
            styleId: d?.style.id,
            name: productName,
            meta: `Custom design · Team order · ${rows.length} piece${rows.length === 1 ? "" : "s"}, named · ${methodLabel}`,
            color: d?.product.colorName ?? "",
            qty: rows.length,
            unit: quote.cartUnit,
            image: proofUrl || d?.product.colorFrontImageUrl || "",
            artworkProofUrl: proofUrl ?? undefined,
            designProjectId: designProjectId ?? undefined,
            pricingSnapshot: quote.snapshot,
            designNotes: (design.notes ?? "").trim() || undefined,
            roster: rows,
          });
          trackCartItemAdded({
            id: productId,
            productId,
            name: productName,
            qty: rows.length,
            unit: quote.cartUnit,
          });
        }
        // Spares carry on into the plain per-size lines below rather than
        // returning here, so a mixed order arrives as named rows *and* the
        // extra blanks.
        if (spareQty === 0) {
          router.push("/cart");
          return;
        }
      }

      for (const { block, size } of rosterMode ? matrixOrderedLines(blocks) : lines) {
        const d = detailsById[block.productId];
        const productName = d
          ? `${d.style.brandName} ${d.style.styleName}`.trim()
          : block.colorName;
        addItem({
          id: `${block.productId}:${size.variantId}`,
          productId: block.productId,
          productSlug: d?.product.slug,
          styleId: d?.style.id,
          variantId: size.variantId,
          name: productName,
          meta: `Custom design · Size ${size.sizeName} · ${methodLabel}`,
          color: block.colorName,
          size: size.sizeName,
          qty: size.quantity,
          unit: quote.cartUnit,
          image: proofUrl || block.imageUrl || "",
          artworkProofUrl: proofUrl ?? undefined,
          designProjectId: designProjectId ?? undefined,
          pricingSnapshot: quote.snapshot,
          designNotes: (design.notes ?? "").trim() || undefined,
        });
        trackCartItemAdded({
          id: block.productId,
          productId: block.productId,
          name: productName,
          qty: size.quantity,
          unit: quote.cartUnit,
        });
      }
      router.push("/cart");
    } finally {
      setAdding(false);
    }
  }

  const availableColourways = (detail?.colorways ?? []).filter(
    (c) => !blocks.some((b) => b.productId === c.id),
  );

  /* ---------------------------------------------------------------- */

  if (!mounted || loading) {
    return (
      <div className="py-sp-6">
        <div className="h-8 w-64 rounded bg-fill-subtle-15 animate-pulse mb-sp-4" />
        <div className="h-64 rounded-lg bg-fill-subtle-15 animate-pulse" />
      </div>
    );
  }

  if (!hasDesign || !garmentProductId) {
    return (
      <div className="py-sp-6">
        <DesignStepBar current="quantity" reached="design" className="mb-sp-5" />
        <div className="border border-border rounded-lg bg-bg-raised p-sp-5 text-center">
          <h1 className="font-display text-[22px] mb-sp-2">
            There is no design to price yet
          </h1>
          <p className="text-text-secondary mb-sp-4 max-w-[46ch] mx-auto">
            Add your artwork in the Design Studio first — then come back here to
            choose colours and quantities.
          </p>
          <Link
            href="/design"
            className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-bold text-white"
          >
            Go to the Design Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-sp-5">
      <DesignStepBar
        current="quantity"
        reached="quantity"
        className="mb-sp-5"
      />

      <div className="grid gap-sp-5 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        {/* ---------------- left: the order ---------------- */}
        <div className="min-w-0">
          <h1 className="font-display text-[24px] mb-sp-1">Input quantity</h1>
          <p className="text-text-secondary mb-sp-4 max-w-[58ch]">
            {rosterMode
              ? "You named everyone in the Design Studio. Pick the size and colour each person takes, then add any extra un-named pieces below."
              : "Enter how many you need of each size. You can order the same design in more than one colour — each colour gets its own size breakdown."}
          </p>

          {/* Named team order: one row per person. Their name and number came
              from the studio (they get printed); the size and colour are the
              ordering half of the same decision, asked here. */}
          {rosterMode && (
            <section className="border border-border rounded-lg bg-bg-raised overflow-hidden mb-sp-4">
              <header className="flex items-center justify-between gap-3 px-sp-4 py-sp-3 border-b border-border bg-bg">
                <div>
                  <p className="m-0 font-bold text-[15px]">
                    {names.length} {names.length === 1 ? "person" : "people"}
                  </p>
                  <p className="m-0 text-[12px] text-text-tertiary">
                    {unsizedCount === 0
                      ? "Everyone has a size"
                      : `${unsizedCount} still ${unsizedCount === 1 ? "needs" : "need"} a size`}
                  </p>
                </div>
                <Link
                  href="/design"
                  className="text-[13px] font-bold text-accent hover:underline shrink-0"
                >
                  Edit names
                </Link>
              </header>

              <ul className="m-0 p-0 list-none">
                {names.map((person, i) => {
                  const a = assignments[i];
                  const d = a ? detailsById[a.productId] : undefined;
                  return (
                    <li
                      key={`${person.name}-${person.number}-${i}`}
                      className="flex flex-wrap items-center gap-2 px-sp-4 py-2.5 border-b border-border last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">
                        {person.name || <em className="text-text-tertiary font-normal">No name</em>}
                        {person.number && (
                          <span className="ml-2 text-text-tertiary font-normal">
                            #{person.number}
                          </span>
                        )}
                      </span>

                      <select
                        aria-label={`Colour for ${person.name || `person ${i + 1}`}`}
                        value={a?.productId ?? ""}
                        onChange={(e) =>
                          setAssignments((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, productId: e.target.value } : row,
                            ),
                          )
                        }
                        className="border border-border rounded-sm bg-bg px-2 py-1.5 text-[13px] font-semibold"
                      >
                        {Object.values(detailsById).map((opt) => (
                          <option key={opt.product.id} value={opt.product.id}>
                            {opt.product.colorName}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label={`Size for ${person.name || `person ${i + 1}`}`}
                        value={a?.sizeName ?? ""}
                        onChange={(e) =>
                          setAssignments((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, sizeName: e.target.value } : row,
                            ),
                          )
                        }
                        className={cn(
                          "border rounded-sm bg-bg px-2 py-1.5 text-[13px] font-semibold min-w-[5rem]",
                          a?.sizeName ? "border-border" : "border-amber-400",
                        )}
                      >
                        <option value="">Size…</option>
                        {(d?.variants ?? []).map((v) => (
                          <option key={v.id} value={v.sizeName}>
                            {v.sizeName}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {rosterMode && (
            <div className="flex items-baseline justify-between gap-3 mb-sp-2">
              <h2 className="m-0 font-display text-[16px]">
                Extra pieces, no name
              </h2>
              <span className="text-[12px] text-text-tertiary">
                Optional — spares, staff or coaches
              </span>
            </div>
          )}

          <div className="flex flex-col gap-sp-4">
            {blocks.map((block) => {
              const qty = blockQuantity(block);
              return (
                <section
                  key={block.productId}
                  className="border border-border rounded-lg bg-bg-raised overflow-hidden"
                >
                  <header className="flex items-center gap-3 px-sp-4 py-sp-3 border-b border-border bg-bg">
                    {block.imageUrl && (
                      <OptionalImage
                        src={block.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded object-contain bg-white"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-bold text-[15px] truncate">
                        {block.colorName}
                      </p>
                      <p className="m-0 text-[12px] text-text-tertiary">
                        {qty > 0
                          ? `${qty.toLocaleString()} piece${qty === 1 ? "" : "s"}`
                          : "No quantities yet"}
                      </p>
                    </div>
                    {/* What this colour costs on its own. The unit price is
                        the whole run's — volume breaks are earned across
                        every colour together, not per colour — so showing a
                        colour's own line total is the only honest way to
                        answer "what is this colour costing me". */}
                    {qty > 0 && quote && (
                      <div className="text-right shrink-0">
                        <p className="m-0 font-bold text-[15px] tabular-nums">
                          {moneyFromMinor(quote.perPieceMinor * qty)}
                        </p>
                        <p className="m-0 text-[11px] text-text-tertiary tabular-nums">
                          {moneyFromMinor(quote.perPieceMinor)} ea
                        </p>
                      </div>
                    )}
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColour(block.productId)}
                        className="text-[12px] font-bold text-text-tertiary hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </header>

                  <div className="p-sp-3 grid gap-2 grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]">
                    {block.sizes.map((size) => (
                      <label
                        key={size.variantId}
                        className={cn(
                          "flex flex-col gap-1 rounded-md border p-2 transition-colors",
                          size.quantity > 0
                            ? "border-accent bg-accent/5"
                            : "border-border",
                          !size.inStock && "opacity-60",
                        )}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-secondary flex items-center justify-between gap-1">
                          {size.sizeName}
                          {!size.inStock && (
                            <span
                              title="Out of stock"
                              className="text-amber-600 text-[10px]"
                            >
                              !
                            </span>
                          )}
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={size.quantity === 0 ? "" : size.quantity}
                          placeholder="0"
                          aria-label={`${block.colorName} ${size.sizeName} quantity`}
                          onChange={(e) =>
                            setSizeQty(
                              block.productId,
                              size.variantId,
                              e.target.value === ""
                                ? 0
                                : Number.parseInt(e.target.value, 10) || 0,
                            )
                          }
                          className="w-full min-h-9 rounded-sm border border-border bg-bg px-2 text-center text-[15px] font-bold tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* add another colour */}
          <div className={cn("mt-sp-4", rosterMode && "-mt-sp-1")}>
            {addingColour ? (
              <div className="border border-border rounded-lg bg-bg-raised p-sp-3">
                <div className="flex items-center justify-between mb-sp-2">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary">
                    Add a colour
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddingColour(false)}
                    className="text-[12px] font-bold text-text-tertiary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
                {availableColourways.length === 0 ? (
                  <p className="m-0 text-[13px] text-text-tertiary">
                    Every colour of this garment is already in your order.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableColourways.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={pendingColourId === c.id}
                        onClick={() => void addColour(c.id)}
                        className="w-[5.5rem] flex flex-col items-center gap-1 rounded-md border border-border p-1.5 text-[12px] font-semibold hover:border-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
                      >
                        {/* The garment in that colour, not an abstract dot —
                            a shopper picking "Heather Grey" wants to see the
                            shirt, and a photo also shows how the colour
                            actually reads on fabric. Falls back to the hex
                            when the vendor has no photo for that colourway. */}
                        {c.frontImageUrl ? (
                          <OptionalImage
                            src={c.frontImageUrl}
                            alt=""
                            width={64}
                            height={64}
                            className="h-16 w-16 object-contain bg-white rounded"
                          />
                        ) : (
                          <span
                            className="h-16 w-16 rounded border border-border"
                            style={{
                              background:
                                c.colorHex ?? "var(--color-fill-subtle-15)",
                            }}
                          />
                        )}
                        {/* Two lines rather than an ellipsis: "Collegiate
                            Navy" and "Collegiate Royal" are different
                            garments, and truncating both to "Collegiate …"
                            makes them impossible to tell apart. */}
                        <span className="w-full text-center leading-tight line-clamp-2">
                          {pendingColourId === c.id ? "Adding…" : c.colorName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColour(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-dashed border-border px-4 font-bold text-text-secondary hover:border-accent hover:text-accent transition-colors"
              >
                + Add another colour
              </button>
            )}
          </div>

          {outOfStock.length > 0 && (
            <p className="mt-sp-3 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {outOfStock
                .map((l) => `${l.colorName} ${l.sizeName}`)
                .join(", ")}{" "}
              {outOfStock.length === 1 ? "is" : "are"} out of stock with our
              supplier. We can still quote it — we will confirm timing before
              production.
            </p>
          )}
        </div>

        {/* ---------------- right: preview + price ---------------- */}
        <aside className="lg:sticky lg:top-sp-4 flex flex-col gap-sp-4">
          <section className="border border-border rounded-lg bg-bg-raised overflow-hidden">
            <h2 className="m-0 px-sp-4 py-sp-3 border-b border-border bg-bg font-display text-[15px]">
              Your design
            </h2>
            {/* One large view with a tab per location, rather than a grid of
                thumbnails: the previous grid handed a fixed 340px preview a
                ~160px column, and the preview clips instead of scaling, so
                the customer saw half a garment. */}
            <div className="p-sp-3">
              <DesignPreviewViewer
                design={design}
                sides={decoratedSides as DesignSide[]}
                imageForSide={(side) =>
                  side === "back"
                    ? detail?.product.colorBackImageUrl ?? null
                    : side === "front"
                      ? detail?.product.colorFrontImageUrl ?? null
                      : detail?.product.colorSideImageUrl ?? null
                }
              />
            </div>
            <div className="px-sp-4 pb-sp-3">
              <Link
                href="/design"
                className="text-[13px] font-bold text-accent hover:underline"
              >
                Edit design
              </Link>
            </div>
          </section>

          <section className="border border-border rounded-lg bg-bg-raised p-sp-4">
            <h2 className="m-0 font-display text-[15px] mb-sp-3">Your price</h2>

            {totalQty === 0 ? (
              <p className="m-0 text-[13px] text-text-tertiary">
                Enter a quantity to see your price.
              </p>
            ) : quote ? (
              <>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[13px] text-text-secondary">
                    Price per piece
                  </span>
                  <span className="font-display text-[26px] leading-none tabular-nums">
                    {moneyFromMinor(quote.perPieceMinor)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[13px] text-text-secondary border-t border-border pt-2 mt-2">
                  <span>
                    {totalQty.toLocaleString()} piece
                    {totalQty === 1 ? "" : "s"} total
                  </span>
                  <span className="font-bold tabular-nums text-text-primary">
                    {moneyFromMinor(quote.totalMinor)}
                  </span>
                </div>
                {/* `perPieceMinor` excludes setup by definition and
                    `totalMinor` includes it, so the two never multiply out.
                    Say so, rather than letting the customer find a gap they
                    cannot account for. */}
                {quote.totalMinor - quote.perPieceMinor * totalQty > 0 && (
                  <div className="flex items-baseline justify-between text-[12px] text-text-tertiary mt-1">
                    <span>One-off setup</span>
                    <span className="tabular-nums">
                      {moneyFromMinor(
                        quote.totalMinor - quote.perPieceMinor * totalQty,
                      )}
                    </span>
                  </div>
                )}
                {namesFeeMinor > 0 && namedQty > 0 && spareQty > 0 && (
                  <p className="mt-sp-3 mb-0 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    {namedQty} of these pieces are personalised with a name or
                    number ({moneyFromMinor(namesFeeMinor)} each). That charge
                    is not in the estimate above because the order also has
                    un-named pieces — we will confirm it with your quote.
                  </p>
                )}
                <p className="mt-sp-3 mb-0 text-[12px] text-text-tertiary">
                  Includes decoration on{" "}
                  {decoratedSides
                    .map((s) => DESIGN_SIDE_LABELS[s as DesignSide].toLowerCase())
                    .join(", ")}
                  . Taxes and shipping are added at checkout.
                </p>
              </>
            ) : (
              <p className="m-0 text-[13px] text-text-tertiary">
                We could not price this automatically. Continue and our team
                will confirm your quote.
              </p>
            )}

            {cartError && (
              <p className="mt-sp-3 mb-0 text-[13px] text-red-600" role="alert">
                {cartError}
              </p>
            )}
            <button
              type="button"
              disabled={matrixIsEmpty(activeBlocks) || adding || !quote}
              onClick={addToCart}
              className="mt-sp-4 w-full min-h-12 rounded-sm bg-accent px-5 font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? "Adding…" : "Continue to review"}
            </button>
            {matrixIsEmpty(activeBlocks) && (
              <p className="mt-2 mb-0 text-center text-[12px] text-text-tertiary">
                {rosterMode
                  ? "Choose a size for each person to continue."
                  : "Add at least one quantity to continue."}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

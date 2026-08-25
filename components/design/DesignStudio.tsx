"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DESIGN_CANVAS_SIZE,
  DESIGN_SIDE_LABELS,
  DesignSides,
  defaultRosterDecor,
  emptyDesignDocument,
  emptyTextsBySide,
  ephemeralArtworkSides,
  isDurableArtworkSrc,
  normalizeDesignDocument,
  type DesignDocument,
  type DesignSide,
  type PlacedArtwork,
  type PlacedText,
  type PricingConfigV2,
  type TextAlign,
  type TextPrintMethod,
} from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { trackCartItemAdded } from "@/lib/analytics/gtag";
import { useCartStore } from "@/lib/store/cart";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import {
  rosterLooksStarted,
  usePdpStudioHandoff,
} from "@/lib/store/pdp-studio-handoff";
import {
  artworkSrcForDraft,
  dataUrlToBlob,
  filenameForArtworkBlob,
} from "@/lib/store/design-draft";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { shopperUnitMinor } from "@/lib/utils/shopper-price";
import {
  PRICING_MASTER_V2,
  priceGarmentFromCurve,
  priceShopperQuote,
  type GarmentPriceCurve,
} from "@gwg/pricing";
import {
  STITCH_PRESETS,
  colourOptions,
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
  stitchCountForPreset,
  type StitchPresetId,
} from "@/lib/utils/shop-quote";
import { type RosterRow } from "@/components/shared/RosterEditor";
import { SHOW_DESIGN_STUDIO_AI_CONCEPT } from "@/lib/features";
import {
  framedBackdropStyles,
  garmentBackdrops,
  studioCanvasImageUrl,
} from "@/lib/commerce/garment-backdrop";
import {
  STUDIO_PRINT_AREAS,
  cartPlacementSuffix,
  cartPrintMetaLabel,
  decoratedDesignSides,
  placeArtworkInZone,
} from "@/lib/commerce/studio-placement";
import { STUDIO_DEFAULT_FONT_ID } from "@/lib/commerce/studio-fonts";
import {
  createStudioHistory,
  type StudioHistorySnapshot,
} from "@/lib/commerce/studio-history";
import {
  centerStudioLayer,
  createStudioTextLayer,
  deleteStudioLayer,
  duplicateStudioLayer,
  estimateTextDisplaySize,
  moveStudioLayerToSide,
  nudgeStudioLayerOrder,
  patchStudioArtwork,
  patchStudioText,
} from "@/lib/commerce/studio-text";
import {
  detectPlacementZone,
  formatZoneInchLabel,
  frontChestGuideRects,
} from "@/lib/commerce/studio-zones";
import { patchRosterDecor } from "@/lib/commerce/studio-roster-decor";
import {
  cartRosterRowsFromDraft,
  studioCartLineFields,
  studioCartRosterPayload,
  studioIsCompleteTeamRoster,
  studioTeamOrderQuantity,
} from "@/lib/commerce/studio-cart-roster";
import { StudioSelect } from "@/components/design/StudioSelect";
import { StudioArticlePicker } from "@/components/design/StudioArticlePicker";
import { StudioColorSwitcher } from "@/components/design/StudioColorSwitcher";
import { GarmentBackdropImage } from "@/components/design/GarmentBackdropImage";
import { StudioFontLoader } from "@/components/design/StudioFontLoader";
import { StudioTextPanel } from "@/components/design/StudioTextPanel";
import { StudioElementEditor } from "@/components/design/StudioElementEditor";
import { StudioTeamOrderPanel } from "@/components/design/StudioTeamOrderPanel";
import { StudioNotesTab } from "@/components/design/StudioNotesTab";
import {
  studioArticleLabel,
  studioColorwaysForArticle,
  studioDetailColorwaysForSelection,
  studioGarmentPhotos,
  studioVariantIdForColorway,
  uniqueStudioArticles,
} from "@/lib/commerce/studio-garments";
import {
  DESIGN_SIDE_THUMB_LABELS,
  isStudioSleeveSide,
  studioSleeveFillFromColorway,
} from "@/lib/commerce/studio-sleeve";
import { readProductSizeChart } from "@/lib/utils/size-specs";

export type DesignGarmentOption = {
  id: string;
  label: string;
  colorName: string;
  imageUrl: string | null;
  sideImageUrl?: string | null;
  backImageUrl?: string | null;
  isDark: boolean;
  slug?: string;
  brandName?: string;
  styleName?: string;
  /** Vendor cost; used when the size-level cost has not loaded yet. */
  costMinor?: number;
};

type ProductDetailVariant = {
  id: string;
  sizeName: string;
  qty: number;
  active: boolean;
  retailMinor: number;
  customerPriceMinor?: number;
  mapPriceMinor?: number | null;
  priceCurve?: GarmentPriceCurve | null;
};

/**
 * Blanks get cheaper per piece as the order grows, matching what the quote
 * builder would say. Without a curve the catalog price stands.
 */
function unitPriceMinor(
  variant: ProductDetailVariant | undefined,
  quantity: number,
  detail?: ProductDetail | null,
): number {
  if (!variant) return 0;
  if (detail?.pricingConfig && variant.customerPriceMinor) {
    return shopperUnitMinor(detail.pricingConfig, {
      unitCostMinor: variant.customerPriceMinor,
      quantity: Math.max(1, quantity),
      mapPriceMinor: variant.mapPriceMinor ?? null,
      colourName: detail.product.colorName,
      isDark: detail.product.isDark,
    });
  }
  if (!variant.priceCurve || !variant.customerPriceMinor) {
    return variant.retailMinor;
  }
  return priceGarmentFromCurve(variant.priceCurve, {
    unitCostMinor: variant.customerPriceMinor,
    quantity: Math.max(1, quantity),
    mapPriceMinor: variant.mapPriceMinor ?? null,
  }).sellPerPieceMinor;
}

type ProductDetailColorway = {
  id: string;
  slug?: string;
  colorName: string;
  colorHex?: string | null;
  color1?: string | null;
  swatchImageUrl?: string | null;
  frontImageUrl?: string | null;
  sideImageUrl?: string | null;
  backImageUrl?: string | null;
  isDark?: boolean;
};

type ProductDetail = {
  product: {
    id: string;
    slug?: string;
    colorName: string;
    colorFrontImageUrl: string | null;
    colorSideImageUrl: string | null;
    colorBackImageUrl: string | null;
    isDark?: boolean;
  };
  style: {
    id: string;
    brandName: string;
    styleName: string;
    styleImageUrl: string | null;
    sizeSpecs?: unknown;
  };
  variants: ProductDetailVariant[];
  colorways?: ProductDetailColorway[];
  sizeSpecs?: unknown;
  pricingConfig?: PricingConfigV2;
};

const DESIGN_QTY_OPTIONS = [24, 48, 96, 250, 500];
const STUDIO_TABS = [
  { id: "images", label: "Images" },
  { id: "text", label: "Text" },
  { id: "team", label: "Team" },
  { id: "notes", label: "Notes" },
] as const;
type StudioTab = (typeof STUDIO_TABS)[number]["id"];
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function snapshotOf(document: DesignDocument): StudioHistorySnapshot {
  return {
    artworksBySide: document.artworksBySide,
    textsBySide: document.textsBySide,
    placementBySide: document.placementBySide,
  };
}

function applyHistorySnapshot(
  document: DesignDocument,
  snapshot: StudioHistorySnapshot,
): DesignDocument {
  return {
    ...document,
    artworksBySide: snapshot.artworksBySide as DesignDocument["artworksBySide"],
    textsBySide: snapshot.textsBySide as DesignDocument["textsBySide"],
    placementBySide: snapshot.placementBySide as DesignDocument["placementBySide"],
  };
}

function rosterRowsFromDesign(document: DesignDocument): RosterRow[] {
  if (!document.roster?.length) return [{ size: "", name: "", number: "" }];
  return document.roster.map((row) => ({
    size: row.size,
    name: row.name,
    number: row.number ?? "",
  }));
}

function firstDurableArtworkUrl(document: DesignDocument): string | undefined {
  for (const side of DesignSides) {
    const found = document.artworksBySide[side].find((layer) =>
      isDurableArtworkSrc(layer.src),
    );
    if (found) return found.src;
  }
  return undefined;
}

// react-konva touches the DOM directly — must be client-only, no SSR. The
// whole canvas (Stage + Layer + artwork layers) is lazy-loaded as ONE unit,
// not per-primitive: react-konva's custom reconciler calls flushSync
// internally on stage updates, and if Stage/Layer are themselves
// React.lazy-wrapped, that synchronous flush can fire before the lazy
// import resolves, outside any Suspense boundary — see DesignCanvas.tsx.
const DesignCanvas = dynamic(() => import("@/components/design/DesignCanvas"), {
  ssr: false,
});

const CANVAS_SIZE = DESIGN_CANVAS_SIZE;

export type SavedDesignProject = {
  id: string;
  name: string;
  garmentProductId: string | null;
  design: DesignDocument;
};

/**
 * Where this studio saves to and uploads through. Staff edit a customer's
 * design from the admin side, which is the same tool pointed at admin-
 * authenticated routes — the customer's own routes are person-scoped and
 * would refuse a staff session, correctly.
 */
export type DesignStudioEndpoints = {
  /** POST target for a new design. Omit where saving new work is not allowed. */
  create?: string;
  /** Collection base for updates; the design id is appended. */
  update?: string;
  /** POST multipart target for artwork and proof uploads. */
  upload?: string;
};

/**
 * Resolves once the browser has fetched `src` under the same anonymous
 * cross-origin mode the Konva canvas uses, so a URL that will not render on
 * the canvas — a private bucket, a missing CORS header — fails here instead
 * of silently at draw time.
 */
function canLoadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new window.Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });
}

/**
 * Natural pixel size, so default scale can be a fraction of the print area
 * instead of `0.4 × whatever the camera dumped`.
 */
function measureArtworkSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const probe = new window.Image();
    const local = /^(blob:|data:)/i.test(src) || src.startsWith("/");
    if (!local) probe.crossOrigin = "anonymous";
    probe.onload = () => {
      const width = probe.naturalWidth || probe.width;
      const height = probe.naturalHeight || probe.height;
      if (width < 1 || height < 1) {
        reject(new Error("Artwork has no size"));
        return;
      }
      resolve({ width, height });
    };
    probe.onerror = () => reject(new Error("Could not measure artwork"));
    probe.src = src;
  });
}

const CUSTOMER_ENDPOINTS: Required<DesignStudioEndpoints> = {
  create: "/api/designs",
  update: "/api/designs",
  upload: "/api/uploads",
};

export function DesignStudio({
  garments = [],
  signedIn = false,
  initialDesign = null,
  garmentIdOverride = null,
  mode = "customer",
  endpoints,
  pricingConfig = PRICING_MASTER_V2,
}: {
  garments?: DesignGarmentOption[];
  signedIn?: boolean;
  initialDesign?: SavedDesignProject | null;
  /** Set when arriving via "Preview my design on this" from a product card/PDP. */
  garmentIdOverride?: string | null;
  /** Staff mode drops the buying controls: nobody checks out from the admin. */
  mode?: "customer" | "staff";
  endpoints?: DesignStudioEndpoints;
  /** Published v2 config — same rates the quote builder and admin preview use. */
  pricingConfig?: PricingConfigV2;
}) {
  const isStaff = mode === "staff";
  const router = useRouter();
  const createUrl = endpoints?.create ?? (isStaff ? undefined : CUSTOMER_ENDPOINTS.create);
  const updateUrl = endpoints?.update ?? CUSTOMER_ENDPOINTS.update;
  const uploadUrl = endpoints?.upload ?? CUSTOMER_ENDPOINTS.upload;

  const addItem = useCartStore((s) => s.addItem);
  const [activeSide, setActiveSide] = useState<DesignSide>("front");
  const [design, setDesign] = useState<DesignDocument>(() =>
    initialDesign ? normalizeDesignDocument(initialDesign.design) : emptyDesignDocument(),
  );
  const artworksBySide = design.artworksBySide;
  const placementBySide = design.placementBySide;
  const [selectedBySide, setSelectedBySide] = useState<
    Record<DesignSide, string | null>
  >({ front: null, back: null, left: null, right: null });
  const [pendingUploads, setPendingUploads] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    initialDesign?.garmentProductId ?? garmentIdOverride ?? null,
  );
  const [changingGarment, setChangingGarment] = useState(false);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [designQty, setDesignQty] = useState(48);
  const quoteMethods = useMemo(
    () => enabledDecorationMethods(pricingConfig),
    [pricingConfig],
  );
  const [methodKey, setMethodKey] = useState(
    () =>
      quoteMethods.find(
        (method) => method.key === pricingConfig.storefront?.defaultMethodKey,
      )?.key ??
      quoteMethods[0]?.key ??
      "screenPrint",
  );
  const [colours, setColours] = useState(
    pricingConfig.storefront?.defaultColours ?? 1,
  );
  const [stitchPreset, setStitchPreset] = useState<StitchPresetId>("medium");
  const [optionKey, setOptionKey] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>(() =>
    initialDesign
      ? rosterRowsFromDesign(normalizeDesignDocument(initialDesign.design))
      : [{ size: "", name: "", number: "" }],
  );
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [studioTab, setStudioTab] = useState<StudioTab>("images");
  const [textDraft, setTextDraft] = useState("");
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
  const [textPrintMethod, setTextPrintMethod] = useState<TextPrintMethod>("print");
  const [textFill, setTextFill] = useState("#111111");
  const [textFontId, setTextFontId] = useState(STUDIO_DEFAULT_FONT_ID);
  const [zoom, setZoom] = useState(1);
  const [liveZone, setLiveZone] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const historyRef = useRef(createStudioHistory());
  const sliderHistoryArmedRef = useRef(false);
  const designRef = useRef(design);
  designRef.current = design;

  const [savedDesignId, setSavedDesignId] = useState<string | null>(
    initialDesign?.id ?? null,
  );
  const [designName, setDesignName] = useState(initialDesign?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const artworkInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const preferredSizeNameRef = useRef<string | null>(null);
  const artworks = artworksBySide[activeSide];
  const textsBySide = design.textsBySide ?? emptyTextsBySide();
  const texts = textsBySide[activeSide] ?? [];
  const rosterDecor = design.rosterDecor ?? defaultRosterDecor();
  const selectedId = selectedBySide[activeSide];
  const selectedText = texts.find((layer) => layer.id === selectedId) ?? null;
  const selectedArtwork = artworks.find((layer) => layer.id === selectedId) ?? null;
  const sideLayerCount = (side: DesignSide) =>
    artworksBySide[side].length + (textsBySide[side]?.length ?? 0);

  useEffect(() => {
    if (!selectedGarmentId) {
      setProductDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/commerce/catalog/products/${selectedGarmentId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ProductDetail | null) => {
        if (!cancelled) setProductDetail(data);
      })
      .catch(() => {
        if (!cancelled) setProductDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGarmentId]);

  useEffect(() => {
    const variants = productDetail?.variants ?? [];
    const nextId = studioVariantIdForColorway({
      variants,
      preferredSizeName: preferredSizeNameRef.current,
    });
    setSelectedVariantId(nextId);
    const next = variants.find((variant) => variant.id === nextId);
    if (next) preferredSizeNameRef.current = next.sizeName;
  }, [productDetail]);

  // Persistent design + 1-click apply: when arriving without an explicit
  // saved design to load, pick up whatever's already in progress (or was
  // last saved) so it follows the customer across the catalog. A
  // `garmentIdOverride` from a "Preview my design on this" click always
  // wins for the garment, while the artwork itself carries over.
  //
  // Zustand persist hydrates from localStorage *after* the first paint.
  // Applying on mount alone raced that and left a returning / signed-in
  // visitor on an empty canvas even though the draft was still in the
  // browser.
  useEffect(() => {
    if (initialDesign || isStaff) return;

    const applyStored = () => {
      if (hasActiveArtwork(design)) return;
      const stored = useActiveDesignStore.getState();
      if (hasActiveArtwork(stored.design)) {
        const restored = normalizeDesignDocument(stored.design);
        setDesign(restored);
        setRoster(rosterRowsFromDesign(restored));
        if (stored.name) setDesignName(stored.name);
        if (stored.savedDesignId) setSavedDesignId(stored.savedDesignId);
        if (!garmentIdOverride && stored.garmentProductId) {
          setSelectedGarmentId(stored.garmentProductId);
        }
      }
      if (garmentIdOverride) {
        setSelectedGarmentId(garmentIdOverride);
      }
    };

    const persistApi = useActiveDesignStore.persist;
    if (persistApi.hasHydrated()) {
      applyStored();
      return;
    }
    return persistApi.onFinishHydration(applyStored);
    // Runs for the first hydration only — this is not a live sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Size, qty, and a roster started on the product page follow "Design this".
  useEffect(() => {
    if (isStaff || !garmentIdOverride || initialDesign) return;
    const applyHandoff = () => {
      const handoff = usePdpStudioHandoff.getState().handoff;
      if (!handoff || handoff.productId !== garmentIdOverride) return;
      if (handoff.sizeName) preferredSizeNameRef.current = handoff.sizeName;
      if (handoff.qty && handoff.qty > 0) setDesignQty(handoff.qty);
      if (rosterLooksStarted(handoff.roster)) {
        setRoster(handoff.roster ?? [{ size: "", name: "", number: "" }]);
        setDesign((prev) => ({
          ...prev,
          roster: (handoff.roster ?? [])
            .filter((row) => row.name.trim() || row.number.trim() || row.size)
            .map((row) => ({
              size: row.size,
              name: row.name,
              number: row.number.trim() || undefined,
            })),
        }));
        setStudioTab("team");
      }
    };
    const persistApi = usePdpStudioHandoff.persist;
    if (persistApi.hasHydrated()) {
      applyHandoff();
      return;
    }
    return persistApi.onFinishHydration(applyHandoff);
  }, [garmentIdOverride, initialDesign, isStaff]);

  // Mirror the working design into the persistent store as it changes so
  // it's there when the customer clicks through to another product.
  useEffect(() => {
    if (isStaff) return;
    if (!hasActiveArtwork(design)) return;
    useActiveDesignStore.getState().setDesign({
      name: designName,
      garmentProductId: selectedGarmentId,
      design,
      savedDesignId,
    });
  }, [design, selectedGarmentId, designName, savedDesignId, isStaff]);

  // If a "Preview my design on this" click brought in a garment outside
  // this page's catalog slice, synthesize a dropdown entry for it from the
  // detail fetch so the selector reflects the garment actually shown.
  const [extraGarment, setExtraGarment] = useState<DesignGarmentOption | null>(null);
  useEffect(() => {
    if (!productDetail || !selectedGarmentId) return;
    if (productDetail.product.id !== selectedGarmentId) return;
    if (garments.some((g) => g.id === selectedGarmentId)) {
      setExtraGarment(null);
      return;
    }
    setExtraGarment({
      id: String(productDetail.product.id),
      slug: productDetail.product.slug,
      label: `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim(),
      colorName: productDetail.product.colorName,
      brandName: productDetail.style.brandName,
      styleName: productDetail.style.styleName,
      imageUrl: productDetail.product.colorFrontImageUrl || productDetail.style.styleImageUrl,
      sideImageUrl: productDetail.product.colorSideImageUrl,
      backImageUrl: productDetail.product.colorBackImageUrl,
      isDark: Boolean(productDetail.product.isDark),
      costMinor: productDetail.variants[0]?.customerPriceMinor,
    });
  }, [productDetail, selectedGarmentId, garments]);
  const garmentOptions = useMemo(
    () => (extraGarment ? [extraGarment, ...garments] : garments),
    [extraGarment, garments],
  );
  const selectedGarment = garmentOptions.find((g) => g.id === selectedGarmentId);
  const articleOptions = useMemo(
    () => uniqueStudioArticles(garmentOptions),
    [garmentOptions],
  );
  const colorwayOptions = useMemo(
    () =>
      studioColorwaysForArticle({
        selectedId: selectedGarmentId,
        garments: garmentOptions,
        detailColorways: studioDetailColorwaysForSelection({
          selectedId: selectedGarmentId,
          productId: productDetail?.product.id,
          colorways: productDetail?.colorways,
        }),
      }),
    [
      selectedGarmentId,
      garmentOptions,
      productDetail?.product.id,
      productDetail?.colorways,
    ],
  );
  const selectedColorway = colorwayOptions.find(
    (colorway) => colorway.id === selectedGarmentId,
  );
  const selectedColorwayReady = Boolean(
    selectedGarmentId && productDetail?.product.id === selectedGarmentId,
  );
  const selectedArticleLabel = selectedGarment
    ? studioArticleLabel(selectedGarment)
    : productDetail
      ? `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim()
      : "Garment";
  const sizeChartHref = useMemo(() => {
    if (!selectedGarmentId || !productDetail || !selectedColorwayReady) {
      return null;
    }
    if (!readProductSizeChart(productDetail)) return null;
    const slug =
      productDetail.product.slug ??
      selectedColorway?.slug ??
      selectedGarment?.slug ??
      garmentOptions.find((option) => option.id === selectedGarmentId)?.slug;
    if (!slug) return null;
    return `/product/${encodeURIComponent(slug)}?id=${encodeURIComponent(selectedGarmentId)}#size-chart`;
  }, [
    productDetail,
    selectedGarmentId,
    selectedColorwayReady,
    selectedColorway,
    selectedGarment,
    garmentOptions,
  ]);

  useEffect(() => {
    for (const option of garmentOptions.slice(0, 4)) {
      for (const url of [option.imageUrl, option.sideImageUrl]) {
        if (!url) continue;
        const img = new window.Image();
        img.src = url;
      }
    }
  }, [garmentOptions]);

  const selectedVariant = productDetail?.variants.find(
    (v) => v.id === selectedVariantId,
  );
  const namedRosterCount = cartRosterRowsFromDraft(roster).length;
  const teamOrderReady = studioIsCompleteTeamRoster(roster);
  const selectedMethod =
    quoteMethods.find((method) => method.key === methodKey) ?? quoteMethods[0];
  const decoratedSides = decoratedDesignSides(artworksBySide, textsBySide);

  const quoted = useMemo(() => {
    const unitCostMinor =
      selectedVariant?.customerPriceMinor ?? selectedGarment?.costMinor ?? 0;
    if (unitCostMinor <= 0) return null;
    const locations = (
      decoratedSides.length > 0 ? decoratedSides : [activeSide]
    ).map((side) => placementBySide[side] || side);
    try {
      return priceShopperQuote(pricingConfig, {
        unitCostMinor,
        quantity: studioTeamOrderQuantity(roster, designQty),
        mapPriceMinor: selectedVariant?.mapPriceMinor ?? null,
        colourName:
          (selectedColorwayReady
            ? productDetail?.product.colorName
            : null) ||
          selectedGarment?.colorName ||
          selectedColorway?.colorName ||
          "",
        isDark:
          selectedGarment?.isDark ??
          (selectedColorwayReady
            ? productDetail?.product.isDark
            : selectedColorway?.isDark),
        methodKey: selectedMethod?.key,
        colours: methodVariableInputs(selectedMethod).colours
          ? colours
          : undefined,
        stitchCount: methodVariableInputs(selectedMethod).stitches
          ? stitchCountForPreset(stitchPreset)
          : undefined,
        optionKey: methodVariableInputs(selectedMethod).option
          ? optionKey || defaultOptionKey(selectedMethod)
          : undefined,
        locations,
        shareSetup: false,
        description: selectedGarment?.label ?? "Custom design",
        decorated: true,
      });
    } catch {
      return null;
    }
  }, [
    activeSide,
    colours,
    decoratedSides,
    designQty,
    optionKey,
    placementBySide,
    pricingConfig,
    productDetail,
    roster,
    selectedColorway,
    selectedColorwayReady,
    selectedGarment,
    selectedMethod,
    selectedVariant,
    stitchPreset,
  ]);

  // Front/back stay the vendor photos. Sleeves use a vendor side shot
  // when the catalog has one, otherwise a photorealistic 3/4 side plate
  // tinted to the colourway — never a crop of the chest photo.
  const garmentPhotos = studioGarmentPhotos({
    selectedId: selectedGarmentId,
    product: productDetail?.product,
    styleImageUrl: productDetail?.style.styleImageUrl,
    styleName:
      selectedGarment?.styleName ?? productDetail?.style.styleName ?? null,
    selectedGarment,
    selectedColorway,
  });
  const sideBackdrops = garmentBackdrops(garmentPhotos);
  const backdrop = sideBackdrops[activeSide];
  const sleeveView = isStudioSleeveSide(activeSide);
  const sleeveFillHex = studioSleeveFillFromColorway(
    selectedColorway,
    (selectedColorwayReady ? productDetail?.product.colorName : null) ||
      selectedGarment?.colorName,
  );
  const sleeveTintHex =
    backdrop.source === "side-view" ? sleeveFillHex : undefined;
  const currentPhoto = backdrop.url;
  const mirrorPhoto = backdrop.mirror;
  const isLoadingGarment = Boolean(selectedGarmentId) && !productDetail;
  const canvasGarmentImageUrl = studioCanvasImageUrl(backdrop);
  const framedBackdrop = framedBackdropStyles(backdrop);

  // All four views are always offered. A sleeve print is a real thing a
  // customer orders whether or not the vendor photographed that angle, and
  // the artwork is stored per view either way.
  const availableViews = DesignSides;

  function setSelectedId(id: string | null) {
    setSelectedBySide((prev) => ({ ...prev, [activeSide]: id }));
  }

  function selectColorway(id: string) {
    if (!id || id === selectedGarmentId) return;
    setSelectedGarmentId(id);
    setChangingGarment(false);
  }

  const updateArtworks = useCallback(
    (side: DesignSide, update: (artworks: PlacedArtwork[]) => PlacedArtwork[]) => {
      setDesign((prev) => ({
        ...prev,
        artworksBySide: {
          ...prev.artworksBySide,
          [side]: update(prev.artworksBySide[side]),
        },
      }));
    },
    [],
  );

  function commitDesign(updater: (prev: DesignDocument) => DesignDocument) {
    const prev = designRef.current;
    historyRef.current.push(snapshotOf(prev));
    const next = updater(prev);
    designRef.current = next;
    setDesign(next);
    setHistoryTick((tick) => tick + 1);
    setExportError(null);
  }

  function undoStudio() {
    const prev = designRef.current;
    const restored = historyRef.current.undo(snapshotOf(prev));
    if (!restored) return;
    const next = applyHistorySnapshot(prev, restored);
    designRef.current = next;
    setDesign(next);
    setHistoryTick((tick) => tick + 1);
    setLiveZone(null);
  }

  function redoStudio() {
    const prev = designRef.current;
    const restored = historyRef.current.redo(snapshotOf(prev));
    if (!restored) return;
    const next = applyHistorySnapshot(prev, restored);
    designRef.current = next;
    setDesign(next);
    setHistoryTick((tick) => tick + 1);
    setLiveZone(null);
  }

  function setActiveArtworks(
    update: (artworks: PlacedArtwork[]) => PlacedArtwork[]
  ) {
    commitDesign((prev) => ({
      ...prev,
      artworksBySide: {
        ...prev.artworksBySide,
        [activeSide]: update(prev.artworksBySide[activeSide]),
      },
    }));
  }

  /**
   * Puts a file somewhere durable and swaps the layer's temporary object URL
   * for the hosted one. Failures are surfaced rather than swallowed: the
   * local preview keeps working, but the customer needs to know the design
   * cannot be saved until the upload lands.
   */
  const uploadArtwork = useCallback(
    async (side: DesignSide, artworkId: string, file: Blob, filename: string) => {
      setPendingUploads((count) => count + 1);
      try {
        const form = new FormData();
        form.append(
          "file",
          file instanceof File ? file : new File([file], filename, { type: file.type }),
        );
        const response = await fetch(uploadUrl, { method: "POST", body: form });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.url) {
          throw new Error(body?.error?.message || "Upload failed.");
        }
        const hostedUrl = String(body.url);
        // Prove the hosted copy is actually readable back — under the same
        // anonymous CORS mode the canvas loads it with — before the layer
        // starts pointing at it. Storing a URL we have never successfully
        // fetched is how a design ends up saved but blank for staff, and the
        // preload doubles as a warm cache so the swap does not flicker.
        if (!(await canLoadImage(hostedUrl))) {
          throw new Error(
            "The upload saved but could not be read back, so it has not been attached.",
          );
        }
        updateArtworks(side, (artworks) =>
          artworks.map((a) => (a.id === artworkId ? { ...a, src: hostedUrl } : a)),
        );
        return hostedUrl;
      } catch (caught) {
        setUploadError(
          caught instanceof Error
            ? caught.message
            : "That artwork could not be uploaded.",
        );
        return null;
      } finally {
        setPendingUploads((count) => count - 1);
      }
    },
    [updateArtworks, uploadUrl],
  );

  // After sign-in, hosted uploads become possible. Promote any data-URL
  // layers left from the unsigned preview so Save / add-to-cart have a
  // durable file instead of a blank reload.
  const ephemeralArtworkKey = DesignSides.flatMap((side) =>
    artworksBySide[side]
      .filter((artwork) => !isDurableArtworkSrc(artwork.src))
      .map((artwork) => artwork.id),
  ).join("|");
  const promotingRef = useRef(false);
  useEffect(() => {
    if (!signedIn || isStaff || promotingRef.current || !ephemeralArtworkKey) {
      return;
    }
    const pending = DesignSides.flatMap((side) =>
      artworksBySide[side]
        .filter((artwork) => !isDurableArtworkSrc(artwork.src))
        .map((artwork) => ({ side, artwork })),
    );
    if (pending.length === 0) return;

    promotingRef.current = true;
    void (async () => {
      try {
        for (const { side, artwork } of pending) {
          const blob = await dataUrlToBlob(artwork.src);
          await uploadArtwork(
            side,
            artwork.id,
            blob,
            filenameForArtworkBlob(blob),
          );
        }
      } catch {
        setUploadError(
          "Sign-in worked, but your artwork still needs to be uploaded. Re-add the file if the canvas looks empty.",
        );
      } finally {
        promotingRef.current = false;
      }
    })();
    // artworksBySide is read at effect start; the key lists every layer
    // that still needs a hosted URL so a successful swap does not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, isStaff, ephemeralArtworkKey, uploadArtwork]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file later
    setUploadError(null);
    void addArtworkFromBlob(file, file.name);
  }

  /**
   * Shows the layer immediately from a local object URL, then replaces that
   * URL with a hosted one. Both steps matter: the object URL is what makes
   * placement feel instant, and the hosted URL is the only part that still
   * exists after the tab closes.
   *
   * Size and position come from the active print area: a 4000px phone photo
   * and a 200px logo both start as a small centered chest mark. The old
   * `scale = 0.4` was 40% of the file's natural pixels, which is why
   * uploads covered the shirt.
   */
  async function addArtworkFromBlob(
    blob: Blob,
    filename: string,
  ): Promise<string | null> {
    const id = crypto.randomUUID();
    const side = activeSide;
    const zone = placementBySide[side];
    // Unsigned visitors cannot upload. A `blob:` URL dies when they leave
    // to confirm an account, so the draft is stored as a data URL that
    // localStorage can bring back onto the canvas after sign-in.
    const src = signedIn
      ? URL.createObjectURL(blob)
      : await artworkSrcForDraft(blob);

    let imageWidth = 1024;
    let imageHeight = 1024;
    try {
      const size = await measureArtworkSize(src);
      imageWidth = size.width;
      imageHeight = size.height;
    } catch {
      // Assumed square keeps the mark small instead of covering the garment.
    }
    const placed = placeArtworkInZone({
      side,
      zone,
      imageWidth,
      imageHeight,
      canvasSize: CANVAS_SIZE,
    });

    const newArtwork: PlacedArtwork = {
      id,
      src,
      ...placed,
      rotation: 0,
    };

    setActiveArtworks((prev) => [...prev, newArtwork]);
    setSelectedId(id);

    if (!signedIn) {
      return null;
    }

    const hostedUrl = await uploadArtwork(side, id, blob, filename);
    if (hostedUrl && src.startsWith("blob:")) URL.revokeObjectURL(src);
    return hostedUrl;
  }

  function removeSelected() {
    if (!selectedId) return;
    commitDesign((prev) => deleteStudioLayer(prev, selectedId));
    setSelectedId(null);
  }

  function addTextLayer() {
    const text = textDraft.trim();
    if (!text) return;
    const layer = createStudioTextLayer({
      side: activeSide,
      text,
      canvasSize: CANVAS_SIZE,
      zone: placementBySide[activeSide],
      fontFamily: textFontId,
      fill: textFill,
      align: textAlign,
      printMethod: textPrintMethod,
    });
    commitDesign((prev) => ({
      ...prev,
      textsBySide: {
        ...(prev.textsBySide ?? emptyTextsBySide()),
        [activeSide]: [
          ...(prev.textsBySide ?? emptyTextsBySide())[activeSide],
          layer,
        ],
      },
    }));
    setSelectedId(layer.id);
    setTextDraft("");
  }

  function commitArtworkChange(next: PlacedArtwork) {
    const width = 80 * Math.abs(next.scaleX);
    const height = 80 * Math.abs(next.scaleY);
    const zone = detectPlacementZone({
      side: activeSide,
      x: next.x,
      y: next.y,
      width,
      height,
      canvasSize: CANVAS_SIZE,
    });
    commitDesign((prev) => ({
      ...prev,
      artworksBySide: {
        ...prev.artworksBySide,
        [activeSide]: prev.artworksBySide[activeSide].map((layer) =>
          layer.id === next.id ? next : layer,
        ),
      },
      placementBySide: { ...prev.placementBySide, [activeSide]: zone },
    }));
    setLiveZone(null);
  }

  function commitTextChange(next: PlacedText) {
    const display = estimateTextDisplaySize(
      next.text,
      next.fontSize,
      next.letterSpacing,
    );
    const zone = detectPlacementZone({
      side: activeSide,
      x: next.x,
      y: next.y,
      width: display.width * Math.abs(next.scaleX),
      height: display.height * Math.abs(next.scaleY),
      canvasSize: CANVAS_SIZE,
    });
    commitDesign((prev) => ({
      ...prev,
      textsBySide: {
        ...(prev.textsBySide ?? emptyTextsBySide()),
        [activeSide]: (prev.textsBySide ?? emptyTextsBySide())[activeSide].map(
          (layer) => (layer.id === next.id ? next : layer),
        ),
      },
      placementBySide: { ...prev.placementBySide, [activeSide]: zone },
    }));
    setLiveZone(null);
  }

  function handleLayerDragMove(info: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    setLiveZone(
      detectPlacementZone({
        side: activeSide,
        x: info.x,
        y: info.y,
        width: info.width,
        height: info.height,
        canvasSize: CANVAS_SIZE,
      }),
    );
  }

  function moveSelectedToSide(side: DesignSide) {
    if (!selectedId) return;
    commitDesign((prev) => moveStudioLayerToSide(prev, selectedId, side, CANVAS_SIZE).document);
    setActiveSide(side);
    setSelectedBySide((prev) => ({ ...prev, [side]: selectedId }));
    setLiveZone(null);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    const newId = crypto.randomUUID();
    commitDesign((prev) => duplicateStudioLayer(prev, selectedId, newId).document);
    setSelectedId(newId);
  }

  function applySelectedTextPatch(patch: Partial<PlacedText>, record = true) {
    if (!selectedId) return;
    if (record) commitDesign((prev) => patchStudioText(prev, selectedId, patch));
    else setDesign((prev) => patchStudioText(prev, selectedId, patch));
  }

  function applySelectedArtworkPatch(patch: Partial<PlacedArtwork>, record = true) {
    if (!selectedId) return;
    if (record) commitDesign((prev) => patchStudioArtwork(prev, selectedId, patch));
    else setDesign((prev) => patchStudioArtwork(prev, selectedId, patch));
  }

  function beginSliderHistory() {
    if (sliderHistoryArmedRef.current) return;
    sliderHistoryArmedRef.current = true;
    historyRef.current.push(snapshotOf(designRef.current));
    setHistoryTick((tick) => tick + 1);
  }

  function endSliderHistory() {
    sliderHistoryArmedRef.current = false;
    setHistoryTick((tick) => tick + 1);
  }

  function patchSelectedWhileSliding(textPatch?: Partial<PlacedText>, artPatch?: Partial<PlacedArtwork>) {
    beginSliderHistory();
    if (textPatch) applySelectedTextPatch(textPatch, false);
    if (artPatch) applySelectedArtworkPatch(artPatch, false);
  }

  function setRosterRows(rows: RosterRow[]) {
    setRoster(rows);
    setRosterError(null);
    setDesign((prev) => ({
      ...prev,
      roster: rows
        .filter((row) => row.name.trim() || row.number.trim() || row.size)
        .map((row) => ({
          size: row.size,
          name: row.name,
          number: row.number.trim() || undefined,
        })),
    }));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redoStudio();
        else undoStudio();
      }
      if ((event.metaKey || event.ctrlKey) && key === "y") {
        event.preventDefault();
        redoStudio();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function generateConcept() {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setGenerating(true);
    setAiError(null);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      `${prompt}, print-ready logo design, clean vector art style, isolated on white background`,
    )}?width=1024&height=1024&seed=${seed}&nologo=true`;

    // Uncached prompts commonly take 20-60s to render on Pollinations'
    // free tier — fetch with a generous timeout so a real failure is
    // distinguishable from "still working", instead of a bare <img> that
    // just hangs with no feedback either way.
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      const blob = await res.blob();
      // Generated art goes through the same upload as an uploaded logo. It
      // used to live only as an object URL, so a design built entirely from
      // an AI concept saved as an empty design — the worst version of the
      // bug, because the customer had nothing on disk to re-upload.
      await addArtworkFromBlob(blob, "ai-concept.png");
      setShowAiPrompt(false);
      setAiPrompt("");
    } catch {
      setAiError(
        "That took too long or failed — the free generator can be slow. Try again or try a shorter prompt.",
      );
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Reading pixels back off the stage throws once any layer is a cross-origin
   * image the host did not send CORS headers for. That became a live risk the
   * moment artwork started being uploaded to S3 instead of living in a
   * same-origin object URL, and a failed export must not take the export
   * button, the cart or the save with it — the design itself is unaffected.
   */
  function exportStageDataUrl(): string | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const transformers = stage.find("Transformer");
    try {
      // Selection handles describe the editor; they are not part of the proof.
      transformers.forEach((node: { hide: () => void }) => node.hide());
      stage.batchDraw();
      return stage.toDataURL({ pixelRatio: 2 });
    } catch {
      return null;
    } finally {
      transformers.forEach((node: { show: () => void }) => node.show());
      stage.batchDraw();
    }
  }

  function downloadProof() {
    const dataUrl = exportStageDataUrl();
    if (!dataUrl) {
      setExportError(
        "The proof could not be rendered. Wait for the garment and artwork to finish loading, then try again.",
      );
      return;
    }
    setExportError(null);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `great-west-graphics-${activeSide}-mockup.png`;
    link.click();
  }

  async function addDesignToCart() {
    if (!productDetail || productDetail.product.id !== selectedGarmentId) {
      setCartError(
        selectedGarmentId
          ? "The selected colour is still loading. Try add to cart again in a moment."
          : "Pick a garment first.",
      );
      return;
    }

    const decorated = decoratedDesignSides(artworksBySide, textsBySide);
    if (decorated.length === 0) {
      setCartError("Place artwork or text on the garment first.");
      return;
    }

    // Validate before uploading: an upload spent on a roster that is about to
    // be rejected is a round trip nobody asked for. A finished Team panel is
    // the order. An empty panel stays a regular size + qty line.
    const rosterPayload = studioCartRosterPayload({
      roster,
      rosterDecor,
    });
    if (!rosterPayload.ok) {
      setRosterError(rosterPayload.error);
      setStudioTab("team");
      return;
    }
    if (!rosterPayload.teamOrder && !selectedVariant) {
      setCartError("Select a size first.");
      return;
    }
    setRosterError(null);

    // The proof has to end up somewhere staff can open. Carrying the canvas as
    // a data: URL looked like it worked and then died on the way to checkout,
    // which is how orders reached production with no artwork attached.
    // Canvas export also fails when the garment photo is cross-origin; in
    // that case the uploaded layer URLs are still enough to add the line.
    setCartError(null);
    setAddingToCart(true);
    try {
      const artworkProofUrl: string | undefined =
        (await uploadProofImage()) ?? firstDurableArtworkUrl(design);
      let designProjectId = savedDesignId ?? undefined;
      if (signedIn && (createUrl || (updateUrl && savedDesignId))) {
        try {
          const name = designName.trim() || defaultDesignName();
          if (!designName.trim()) setDesignName(name);
          designProjectId = await persistDesign(name, artworkProofUrl ?? null);
        } catch (caught) {
          if (!artworkProofUrl) throw caught;
        }
      }
      if (!artworkProofUrl && !designProjectId) {
        setCartError(
          signedIn
            ? "Your artwork could not be attached, so the order would reach us blank. Try again."
            : "Sign in first — otherwise your artwork does not travel with the order.",
        );
        return;
      }

      const printLabel = cartPrintMetaLabel(decorated, placementBySide);
      const productName =
        `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim();
      const productSlug =
        productDetail.product.slug ??
        garmentOptions.find((option) => option.id === selectedGarmentId)?.slug;
      const line = studioCartLineFields(rosterPayload, {
        printLabel,
        notes: design.notes,
        sizeName: selectedVariant?.sizeName ?? "",
        designQty,
      });

      if (rosterPayload.teamOrder) {
        const cartRoster = line.roster;
        if (!cartRoster || line.qty !== cartRoster.length) {
          setRosterError("Add at least one person.");
          setStudioTab("team");
          return;
        }
        const priceVariant =
          productDetail.variants.find((v) => v.sizeName === cartRoster[0]?.size) ??
          selectedVariant;
        if (!priceVariant) {
          setCartError("Select a size for the first roster row.");
          setStudioTab("team");
          return;
        }
        addItem({
          id: productDetail.product.id,
          productId: productDetail.product.id,
          productSlug,
          styleId: productDetail.style.id,
          variantId: priceVariant.id,
          name: productName,
          meta: line.meta,
          color: productDetail.product.colorName,
          qty: line.qty,
          unit:
            quoted?.cartUnit ??
            unitPriceMinor(priceVariant, line.qty, productDetail) / 100,
          image: artworkProofUrl || currentPhoto || "",
          artworkProofUrl,
          designProjectId,
          pricingSnapshot: quoted?.snapshot,
          roster: cartRoster,
          designNotes: (design.notes ?? "").trim() || undefined,
          rosterDecor: line.rosterDecor,
        });
        trackCartItemAdded({
          id: productDetail.product.id,
          productId: productDetail.product.id,
          name: productName,
          qty: line.qty,
          unit:
            quoted?.cartUnit ??
            unitPriceMinor(priceVariant, line.qty, productDetail) / 100,
        });
        router.push("/cart");
        return;
      }

      if (!selectedVariant) {
        setCartError("Select a size first.");
        return;
      }
      addItem({
        id: productDetail.product.id,
        productId: productDetail.product.id,
        productSlug,
        styleId: productDetail.style.id,
        variantId: selectedVariant.id,
        name: productName,
        meta: line.meta,
        color: productDetail.product.colorName,
        qty: line.qty,
        unit:
          quoted?.cartUnit ??
          unitPriceMinor(selectedVariant, line.qty, productDetail) / 100,
        image: artworkProofUrl || currentPhoto || "",
        artworkProofUrl,
        designProjectId,
        pricingSnapshot: quoted?.snapshot,
        designNotes: (design.notes ?? "").trim() || undefined,
        rosterDecor: line.rosterDecor,
      });
      trackCartItemAdded({
        id: productDetail.product.id,
        productId: productDetail.product.id,
        name: productName,
        qty: line.qty,
        unit:
          quoted?.cartUnit ??
          unitPriceMinor(selectedVariant, line.qty, productDetail) / 100,
      });
      router.push("/cart");
    } catch (caught) {
      setCartError(
        caught instanceof Error
          ? caught.message
          : "The design could not be saved, so staff would not be able to reopen it. Try Save, then add to cart again.",
      );
    } finally {
      setAddingToCart(false);
    }
  }

  /**
   * Renders the active view and puts it somewhere staff can open. Failing to
   * upload the proof is not worth failing the save over — every reader can
   * redraw the design from the document — so it degrades to no proof rather
   * than to a data: URL inlined into the row, which is what it used to do.
   */
  async function uploadProofImage(): Promise<string | null> {
    const dataUrl = exportStageDataUrl();
    if (!dataUrl) return null;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append("file", new File([blob], "proof.png", { type: "image/png" }));
      const response = await fetch(uploadUrl, { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      return response.ok && body?.url ? String(body.url) : null;
    } catch {
      return null;
    }
  }

  function defaultDesignName() {
    const garment =
      garmentOptions.find((option) => option.id === selectedGarmentId)?.label ??
      "Custom design";
    return `${garment} · ${new Date().toLocaleDateString("en-CA")}`;
  }

  async function persistDesign(
    name: string,
    proofImageUrl?: string | null,
  ): Promise<string> {
    if (pendingUploads > 0) {
      throw new Error("Hold on — artwork is still uploading.");
    }
    // The guard that makes a save honest. Without it the design persists
    // object URLs, reports success, and reloads blank.
    const unsafeSides = ephemeralArtworkSides(design);
    if (unsafeSides.length > 0) {
      throw new Error(
        `Artwork on the ${unsafeSides
          .map((side) => DESIGN_SIDE_LABELS[side].toLowerCase())
          .join(" and ")} has not been uploaded yet, so it would not survive a reload. ${
          signedIn
            ? "Remove and re-add it, then save again."
            : "Sign in and re-add it to keep it."
        }`,
      );
    }
    const proof = proofImageUrl === undefined ? await uploadProofImage() : proofImageUrl;
    const payload: Record<string, unknown> = {
      name,
      garmentProductId: selectedGarmentId,
      design,
    };
    if (proof) payload.proofImageUrl = proof;
    const currentId = savedDesignId;
    const target = currentId ? `${updateUrl}/${currentId}` : createUrl;
    if (!target) throw new Error("This design cannot be saved from here.");
    const response = await fetch(target, {
      method: currentId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message || "Could not save the design.");
    }
    const id = currentId ?? (body?.design?.id as string | undefined);
    if (!id) throw new Error("The design saved without an id.");
    if (!currentId) setSavedDesignId(id);
    return id;
  }

  async function handleSaveDesign() {
    if (!designName.trim()) {
      setSaveError("Give this design a name first.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await persistDesign(designName.trim());
      setSaveMessage("Design saved ✓");
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "Could not save the design.",
      );
    } finally {
      setSaving(false);
    }
  }

  const placementSuffix = cartPlacementSuffix(
    decoratedSides,
    placementBySide,
    activeSide,
  );

  const canUndo = historyTick >= 0 && historyRef.current.canUndo;
  const canRedo = historyTick >= 0 && historyRef.current.canRedo;
  const guideZone = liveZone ?? placementBySide[activeSide];
  const chestGuides = frontChestGuideRects();
  const draggingOnFront = liveZone !== null && activeSide === "front";
  const selectedPrintLabel = selectedText
    ? selectedText.printMethod === "embroidery"
      ? "Embroidery"
      : "Print"
    : "Print";
  const zoomIndex = ZOOM_STEPS.findIndex((step) => step >= zoom - 0.001);
  const zoomAt = zoomIndex < 0 ? ZOOM_STEPS.indexOf(1) : zoomIndex;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-sp-3 items-start">
      <StudioFontLoader />
      {/* Product and artwork controls. Every visible control is interactive. */}
      <aside className="bg-bg-raised border border-border rounded-lg overflow-hidden flex flex-col min-h-[520px] min-w-0">
        <div className="p-sp-4 flex flex-col gap-2.5 flex-1 min-w-0">
        {garmentOptions.length > 0 && (
          <div className="relative z-10 mb-sp-2 min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-2">
              Product
            </span>
            {selectedGarmentId ? (
              <>
                <h4 className="font-display text-[16px] mb-1 truncate">
                  {selectedArticleLabel}
                </h4>
                <div className="mb-2">
                  <StudioColorSwitcher
                    tone="panel"
                    colorways={colorwayOptions}
                    selectedId={selectedGarmentId}
                    onChange={selectColorway}
                  />
                </div>
                {articleOptions.length > 1 && (
                  <button
                    type="button"
                    className="mt-2 text-[12.5px] font-semibold text-text-tertiary hover:text-accent transition-colors"
                    onClick={() => setChangingGarment((open) => !open)}
                    aria-expanded={changingGarment}
                  >
                    {changingGarment ? "Cancel" : "Change garment"}
                  </button>
                )}
                {changingGarment && (
                  <div className="mt-2">
                    <StudioArticlePicker
                      articles={articleOptions}
                      onPick={(id) => {
                        setSelectedGarmentId(id);
                        setChangingGarment(false);
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <h4 className="font-display text-[16px] mb-2">Choose a garment</h4>
                <StudioArticlePicker
                  articles={articleOptions}
                  onPick={(id) => setSelectedGarmentId(id)}
                />
              </>
            )}
          </div>
        )}

        <ul className="m-0 mb-sp-2 pl-4 text-sm text-text-secondary space-y-1">
          <li>Made from 100% combed ring-spun cotton</li>
          <li>Weighs 6.5oz, reinforced seams</li>
          <li>Classic fit, true to size</li>
        </ul>

        <div className="grid grid-cols-4 gap-1 mb-2">
          {STUDIO_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStudioTab(tab.id)}
              className={cn(
                "h-8 rounded-sm border text-[10px] font-bold uppercase tracking-[0.06em] transition-colors",
                studioTab === tab.id
                  ? "bg-accent text-white border-accent"
                  : "border-border text-text-tertiary hover:border-text-tertiary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          ref={artworkInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={handleFileSelected}
        />

        {studioTab === "images" && (
          <>
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-2">
          Images
        </span>
        <button
          onClick={() => artworkInputRef.current?.click()}
          className="w-full border border-dashed border-border rounded-md py-3 font-bold text-sm hover:border-accent hover:text-accent hover:bg-accent-tint transition-colors"
        >
          Upload art
        </button>
        <p className="m-0 text-[11px] leading-4 text-text-tertiary">
          PNG, JPG or SVG. You can add more than one layer.
        </p>
          </>
        )}

        {studioTab === "text" && (
          <StudioTextPanel
            draft={textDraft}
            onDraftChange={setTextDraft}
            align={selectedText?.align ?? textAlign}
            onAlignChange={(value) => {
              setTextAlign(value);
              if (selectedText) applySelectedTextPatch({ align: value });
            }}
            printMethod={selectedText?.printMethod ?? textPrintMethod}
            onPrintMethodChange={(value) => {
              setTextPrintMethod(value);
              if (selectedText) applySelectedTextPatch({ printMethod: value });
            }}
            fill={selectedText?.fill ?? textFill}
            onFillChange={(value) => {
              setTextFill(value);
              if (selectedText) applySelectedTextPatch({ fill: value });
            }}
            fontId={selectedText?.fontFamily ?? textFontId}
            onFontChange={(value) => {
              setTextFontId(value);
              if (selectedText) applySelectedTextPatch({ fontFamily: value });
            }}
            onAdd={addTextLayer}
          />
        )}

        {studioTab === "team" && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[13px] leading-5 text-text-secondary">
              {teamOrderReady
                ? `${roster.length.toLocaleString()} piece${roster.length === 1 ? "" : "s"} on the team list below.`
                : namedRosterCount > 0
                  ? "Finish every row on the team list below — or use Text for one name."
                  : "The team list is below the canvas, with room for names."}
            </p>
            <button
              type="button"
              onClick={() => {
                document.getElementById("studio-team-order")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="text-left text-[12.5px] font-semibold text-accent hover:underline"
            >
              {namedRosterCount > 0 ? "Jump to team list" : "Add a team list"}
            </button>
          </div>
        )}

        {studioTab === "notes" && (
          <StudioNotesTab
            value={design.notes ?? ""}
            onChange={(notes) => setDesign((prev) => ({ ...prev, notes }))}
          />
        )}

        {studioTab === "images" && SHOW_DESIGN_STUDIO_AI_CONCEPT ? (
        <button
          onClick={() => setShowAiPrompt((open) => !open)}
          className="bg-accent border border-accent text-white rounded-md py-3 font-bold text-sm hover:bg-accent-hover transition-colors"
        >
          Generate an AI concept
        </button>
        ) : null}

        {studioTab === "images" && SHOW_DESIGN_STUDIO_AI_CONCEPT && showAiPrompt && (
          <div className="rounded-md border border-border bg-bg p-sp-3">
            <label className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
              Describe your concept
            </label>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Vintage mountain badge for a staff tee"
              className="w-full min-h-24 resize-y rounded-sm border border-border bg-bg-raised p-3 text-base font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={generateConcept}
              disabled={!aiPrompt.trim() || generating}
              className="mt-2 w-full rounded-sm bg-text-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {generating ? "Building concept… (can take up to a minute)" : "Generate preview"}
            </button>
            {aiError && (
              <p className="text-[11px] leading-4 text-red-600 mt-2">{aiError}</p>
            )}
            <p className="text-[11px] leading-4 text-text-tertiary mt-2">
              AI-generated starting point — review and adjust before printing.
              First-time prompts can take up to a minute to render.
            </p>
          </div>
        )}

        {(studioTab === "images" || studioTab === "text") &&
          (artworks.length > 0 || texts.length > 0) && (
          <div className="mt-sp-3">
            <span className="block text-[11px] font-bold tracking-[0.1em] uppercase text-text-tertiary mb-2">
              {DESIGN_SIDE_LABELS[activeSide]} layers
            </span>
            <div className="flex flex-col gap-1.5">
              {artworks.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "text-left px-2.5 py-2 rounded-md text-[13px] font-semibold border transition-colors",
                    selectedId === a.id
                      ? "border-accent bg-accent-tint text-accent"
                      : "border-border hover:border-text-tertiary"
                  )}
                >
                  Artwork {i + 1}
                </button>
              ))}
              {texts.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedId(layer.id)}
                  className={cn(
                    "text-left px-2.5 py-2 rounded-md text-[13px] font-semibold border transition-colors truncate",
                    selectedId === layer.id
                      ? "border-accent bg-accent-tint text-accent"
                      : "border-border hover:border-text-tertiary"
                  )}
                >
                  “{layer.text || "Text"}”
                </button>
              ))}
            </div>
            {selectedId && (
              <button
                onClick={removeSelected}
                className="mt-2 text-[12.5px] font-semibold text-text-tertiary hover:text-accent transition-colors"
              >
                Remove selected layer
              </button>
            )}
          </div>
        )}
        </div>
      </aside>

      {/* Canvas */}
      <div className="min-w-0 w-full bg-text-primary text-white rounded-lg overflow-hidden flex flex-col">
        <div className="px-sp-4 py-sp-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <b className="font-display text-[15px]">2D Design Canvas</b>
            <span className="block text-[11px] text-white/55 mt-0.5">
              {DESIGN_SIDE_LABELS[activeSide].toUpperCase()} · PRINT METHOD · {selectedPrintLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={undoStudio}
              disabled={!canUndo}
              className="h-8 px-2 rounded-sm border border-white/15 text-[11px] font-bold text-white/80 disabled:opacity-35 hover:border-white/40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redoStudio}
              disabled={!canRedo}
              className="h-8 px-2 rounded-sm border border-white/15 text-[11px] font-bold text-white/80 disabled:opacity-35 hover:border-white/40"
            >
              Redo
            </button>
            <div className="flex items-center gap-1 ml-1" aria-label="Zoom">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={zoomAt <= 0}
                onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomAt - 1)]!)}
                className="h-8 w-8 rounded-sm border border-white/15 text-white/80 font-bold disabled:opacity-35"
              >
                −
              </button>
              <span className="min-w-12 text-center text-[11px] font-bold text-white/80">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={zoomAt >= ZOOM_STEPS.length - 1}
                onClick={() =>
                  setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomAt + 1)]!)
                }
                className="h-8 w-8 rounded-sm border border-white/15 text-white/80 font-bold disabled:opacity-35"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {colorwayOptions.length > 0 && (
          <div className="relative z-10 px-sp-4 py-sp-3 border-b border-white/10">
            <StudioColorSwitcher
              tone="canvas"
              colorways={colorwayOptions}
              selectedId={selectedGarmentId}
              onChange={selectColorway}
            />
          </div>
        )}

        <div className="p-sp-3 min-h-[280px] sm:min-h-[340px] overflow-x-auto">
          <div className="min-w-0 w-full max-w-full bg-[#141414] rounded-md flex flex-col-reverse sm:flex-row items-stretch justify-center gap-3 p-sp-3">
            <div className="min-w-0 flex-1 flex items-center justify-center">
            <div
              className="relative w-full max-w-[600px] aspect-square"
              onClick={(e) => {
                // Clicking empty canvas area deselects the active layer.
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
            >
              {currentPhoto ? (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <GarmentBackdropImage
                    url={currentPhoto}
                    frame={framedBackdrop.frame}
                    image={framedBackdrop.image}
                    tintHex={sleeveTintHex}
                  />
                </div>
              ) : null}
              {isLoadingGarment && !currentPhoto && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-2/3 h-2/3 rounded-md bg-white/5 animate-pulse" />
                </div>
              )}

              {/* One stage owns garment and artwork, so what the customer
                  edits is exactly what the proof download contains. */}
              <DesignCanvas
                activeSide={activeSide}
                artworks={artworks}
                texts={texts}
                selectedId={selectedId}
                canvasSize={CANVAS_SIZE}
                zoom={zoom}
                garmentImageUrl={canvasGarmentImageUrl}
                mirrorGarment={mirrorPhoto}
                garmentCrop={backdrop.crop}
                garmentPlate={backdrop.plate}
                garmentTintHex={sleeveTintHex}
                stageRef={stageRef}
                onSelect={setSelectedId}
                onChangeArtwork={commitArtworkChange}
                onChangeText={commitTextChange}
                onDragMove={handleLayerDragMove}
              />
              {/* CSS overlay so the guide never lands in the Konva proof. */}
              {draggingOnFront ? (
                <>
                  {chestGuides.map(({ zone, rect }) => {
                    const active = liveZone === zone;
                    return (
                      <div
                        key={zone}
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute z-[3] rounded-[2px] border border-dashed",
                          active
                            ? "border-accent bg-accent/25 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                            : "border-white/40 bg-white/5",
                        )}
                        style={{
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.width * 100}%`,
                          height: `${rect.height * 100}%`,
                        }}
                      >
                        <span
                          className={cn(
                            "absolute left-0.5 top-0.5 right-0.5 rounded-[2px] px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-white",
                            active ? "bg-accent" : "bg-black/50",
                          )}
                        >
                          {formatZoneInchLabel(zone)}
                        </span>
                      </div>
                    );
                  })}
                  {liveZone === "Full Front" ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute z-[4] rounded-[2px] border-2 border-dashed border-accent bg-accent/10"
                      style={{
                        left: `${STUDIO_PRINT_AREAS.front.x * 100}%`,
                        top: `${STUDIO_PRINT_AREAS.front.y * 100}%`,
                        width: `${STUDIO_PRINT_AREAS.front.width * 100}%`,
                        height: `${STUDIO_PRINT_AREAS.front.height * 100}%`,
                      }}
                    >
                      <span className="absolute left-1 top-0.5 rounded-[2px] bg-accent px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
                        {formatZoneInchLabel("Full Front")}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : (
              <div
                aria-hidden
                className="pointer-events-none absolute z-[2] rounded-[2px] border border-dashed border-white/40 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                style={{
                  left: `${STUDIO_PRINT_AREAS[activeSide].x * 100}%`,
                  top: `${STUDIO_PRINT_AREAS[activeSide].y * 100}%`,
                  width: `${STUDIO_PRINT_AREAS[activeSide].width * 100}%`,
                  height: `${STUDIO_PRINT_AREAS[activeSide].height * 100}%`,
                }}
              >
                <span className="absolute left-1 top-0.5 right-1 rounded-[2px] bg-black/45 px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
                  {formatZoneInchLabel(guideZone)}
                </span>
              </div>
              )}
              {sleeveView && artworks.length === 0 && texts.length === 0 && (
                <div
                  className="absolute z-[3] flex flex-col items-center justify-center gap-2"
                  style={{
                    left: `${STUDIO_PRINT_AREAS[activeSide].x * 100}%`,
                    top: `${STUDIO_PRINT_AREAS[activeSide].y * 100}%`,
                    width: `${STUDIO_PRINT_AREAS[activeSide].width * 100}%`,
                    height: `${STUDIO_PRINT_AREAS[activeSide].height * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => artworkInputRef.current?.click()}
                    className="min-h-9 rounded-md bg-white px-3 py-1.5 text-[12px] font-bold text-text-primary hover:bg-accent hover:text-white transition-colors"
                  >
                    Upload art
                  </button>
                </div>
              )}
            </div>
            </div>
            <div className="flex sm:flex-col gap-2 shrink-0 sm:w-[92px]">
              {availableViews.map((side) => {
                const selected = activeSide === side;
                const thumbBackdrop = sideBackdrops[side];
                const thumbFrame = framedBackdropStyles(thumbBackdrop);
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => {
                      setActiveSide(side);
                      setExportError(null);
                    }}
                    aria-pressed={selected}
                    aria-label={DESIGN_SIDE_LABELS[side]}
                    className={cn(
                      "flex-1 sm:flex-none rounded-md border overflow-hidden bg-black/30 text-left transition-colors",
                      selected
                        ? "border-accent ring-1 ring-accent"
                        : "border-white/15 hover:border-white/40",
                    )}
                  >
                    <span className="block aspect-square relative bg-[#1a1a1a]">
                      {thumbBackdrop.url ? (
                        <span className="absolute inset-0 overflow-hidden">
                          <GarmentBackdropImage
                            url={thumbBackdrop.url}
                            frame={thumbFrame.frame}
                            image={thumbFrame.image}
                            tintHex={
                              thumbBackdrop.source === "side-view"
                                ? sleeveFillHex
                                : undefined
                            }
                          />
                        </span>
                      ) : (
                        <span className="absolute inset-0 bg-white/5" />
                      )}
                      {sideLayerCount(side) > 0 && (
                        <span className="absolute top-1 right-1 rounded-full bg-accent px-1.5 text-[9px] font-bold text-white">
                          {sideLayerCount(side)}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "block px-1.5 py-1 text-[10px] font-bold tracking-[0.04em] text-center",
                        selected ? "bg-accent text-white" : "text-white/70",
                      )}
                    >
                      {DESIGN_SIDE_THUMB_LABELS[side]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {(selectedText || selectedArtwork) && (
          <StudioElementEditor
            kind={selectedText ? "text" : "artwork"}
            activeSide={activeSide}
            text={
              selectedText
                ? {
                    align: selectedText.align,
                    printMethod: selectedText.printMethod,
                    fill: selectedText.fill,
                    fontFamily: selectedText.fontFamily,
                    letterSpacing: selectedText.letterSpacing ?? 0,
                    arc: selectedText.arc ?? 0,
                    sample: selectedText.text,
                  }
                : undefined
            }
            onPatchText={(patch) => {
              const sliding =
                patch.arc !== undefined || patch.letterSpacing !== undefined;
              if (sliding) patchSelectedWhileSliding(patch);
              else applySelectedTextPatch(patch);
            }}
            outline={Boolean(selectedText?.outline ?? selectedArtwork?.outline)}
            rotation={
              selectedText?.rotation ?? selectedArtwork?.rotation ?? 0
            }
            size={
              selectedText
                ? selectedText.fontSize
                : Math.round(Math.abs(selectedArtwork?.scaleX ?? 0.2) * 500)
            }
            onOutline={(next) => {
              if (selectedText) applySelectedTextPatch({ outline: next });
              else applySelectedArtworkPatch({ outline: next });
            }}
            onRotation={(next) => {
              if (selectedText) patchSelectedWhileSliding({ rotation: next });
              else patchSelectedWhileSliding(undefined, { rotation: next });
            }}
            onSize={(next) => {
              if (selectedText) patchSelectedWhileSliding({ fontSize: next });
              else {
                const scale = next / 500;
                patchSelectedWhileSliding(undefined, {
                  scaleX: scale,
                  scaleY: scale,
                });
              }
            }}
            onCenter={() => {
              if (!selectedId) return;
              const display = selectedText
                ? estimateTextDisplaySize(
                    selectedText.text,
                    selectedText.fontSize,
                    selectedText.letterSpacing,
                  )
                : { width: 80, height: 80 };
              commitDesign((prev) =>
                centerStudioLayer(
                  prev,
                  selectedId,
                  CANVAS_SIZE,
                  display.width,
                  display.height,
                ),
              );
            }}
            onForward={() => {
              if (!selectedId) return;
              commitDesign((prev) =>
                nudgeStudioLayerOrder(prev, selectedId, "forward"),
              );
            }}
            onBack={() => {
              if (!selectedId) return;
              commitDesign((prev) =>
                nudgeStudioLayerOrder(prev, selectedId, "back"),
              );
            }}
            onDuplicate={duplicateSelected}
            onDelete={removeSelected}
            onMoveToSide={moveSelectedToSide}
            onSliderCommit={endSliderHistory}
          />
        )}
      </div>

      {studioTab === "team" && (
        <div
          id="studio-team-order"
          className="lg:col-span-2 bg-bg-raised border border-border rounded-lg p-sp-4 scroll-mt-24"
        >
          <StudioTeamOrderPanel
            roster={roster}
            onRosterChange={setRosterRows}
            rosterError={rosterError}
            sizes={(productDetail?.variants ?? [])
              .filter((variant) => variant.qty > 0 && variant.active !== false)
              .map((variant) => ({ id: variant.id, label: variant.sizeName }))}
            decor={rosterDecor}
            onDecorChange={(target, patch) =>
              setDesign((prev) => ({
                ...prev,
                rosterDecor: patchRosterDecor(
                  prev.rosterDecor ?? defaultRosterDecor(),
                  target,
                  patch,
                ),
              }))
            }
          />
        </div>
      )}

      {/* Saving, proof download and ordering belong to the main workspace,
          below the canvas they act on — not in a duplicate preview panel. */}
      <div className="lg:col-start-2 bg-bg-raised border border-border rounded-lg p-sp-4">
        <h3 className="font-display text-[18px] mb-sp-3">Finish your design</h3>
        <div className="flex flex-col gap-2">
          {signedIn ? (
            <div className="border border-border rounded-md p-sp-3 bg-bg">
              <label className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                Save this design
              </label>
              <div className="flex gap-2">
                <input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="e.g. Staff hoodie logo"
                  className="flex-1 min-w-0 min-h-11 rounded-sm border border-border bg-bg-raised px-3 py-2.5 text-base font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <button
                  onClick={handleSaveDesign}
                  disabled={saving || pendingUploads > 0}
                  className="shrink-0 min-h-11 rounded-sm bg-text-primary px-3.5 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {saving
                    ? "Saving…"
                    : pendingUploads > 0
                      ? "Uploading…"
                      : savedDesignId
                        ? "Update"
                        : "Save"}
                </button>
              </div>
              {pendingUploads > 0 && (
                <p className="text-[12px] text-text-tertiary mt-1.5 mb-0">
                  Uploading artwork so it survives a reload…
                </p>
              )}
              {uploadError && (
                <p className="text-[12px] text-red-600 mt-1.5 mb-0">{uploadError}</p>
              )}
              {saveMessage && (
                <p className="text-[12px] text-green-700 mt-1.5 mb-0">{saveMessage}</p>
              )}
              {saveError && (
                <p className="text-[12px] text-red-600 mt-1.5 mb-0">{saveError}</p>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-text-tertiary border border-border rounded-md p-sp-3 bg-bg">
              <Link href="/account?next=/design" className="text-accent font-bold">
                Sign in
              </Link>{" "}
              to keep this mockup on your account. The artwork stays on this
              canvas when you come back — then we upload it so staff can open
              the same file.
            </p>
          )}

          <Button
            className="w-full"
            onClick={downloadProof}
            disabled={
              (artworks.length === 0 && texts.length === 0) || isLoadingGarment
            }
          >
            {artworks.length === 0 && texts.length === 0
              ? `Add artwork to the ${DESIGN_SIDE_LABELS[activeSide].toLowerCase()} first`
              : `Download ${DESIGN_SIDE_LABELS[activeSide]} Mockup`}
          </Button>
          {exportError && (
            <p className="m-0 text-sm text-danger" role="alert">
              {exportError}
            </p>
          )}
          <p className="text-[12px] text-text-tertiary text-center -mt-1">
            Downloads the selected garment view with all placed artwork.
          </p>

          {productDetail && selectedColorwayReady && !isStaff && (
            <div className="mt-sp-3 pt-sp-3 border-t border-border">
              {teamOrderReady ? (
                <div className="mb-sp-3 rounded-md border border-border bg-bg p-sp-3">
                  <p className="m-0 text-xs text-text-secondary">
                    Team order · {roster.length.toLocaleString()} piece
                    {roster.length === 1 ? "" : "s"} from the team list
                    (mixed sizes).
                  </p>
                  <button
                    type="button"
                    onClick={() => setStudioTab("team")}
                    className="mt-2 text-xs font-bold text-accent hover:underline"
                  >
                    Edit team list
                  </button>
                  {sizeChartHref && (
                    <p className="m-0 mt-2 text-xs">
                      <a
                        href={sizeChartHref}
                        className="font-semibold text-accent hover:underline"
                      >
                        Size chart
                      </a>
                    </p>
                  )}
                  {rosterError && (
                    <p className="text-[12px] text-red-600 font-semibold mt-2 mb-0">
                      {rosterError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {productDetail.variants.length > 0 && (
                    <>
                      <span className="text-xs font-bold mb-1.5 flex items-center justify-between gap-2">
                        <span>
                          Size:{" "}
                          <span className="font-normal">
                            {selectedVariant?.sizeName ?? "Select a size"}
                          </span>
                        </span>
                        {sizeChartHref && (
                          <a
                            href={sizeChartHref}
                            className="font-semibold text-accent hover:underline"
                          >
                            Size chart
                          </a>
                        )}
                      </span>
                      <div className="flex gap-1.5 flex-wrap mb-sp-3">
                        {productDetail.variants.map((v) => {
                          const inStock = v.qty > 0 && v.active !== false;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={!inStock}
                              onClick={() => {
                                preferredSizeNameRef.current = v.sizeName;
                                setSelectedVariantId(v.id);
                              }}
                              className={cn(
                                "min-w-9 h-8 px-2 grid place-items-center border rounded-sm font-bold text-[12px] transition-colors",
                                !inStock &&
                                  "opacity-50 cursor-not-allowed border-amber-300 text-amber-800 bg-amber-50",
                                inStock &&
                                  (v.id === selectedVariantId
                                    ? "bg-accent text-white border-accent"
                                    : "border-border hover:border-text-tertiary"),
                              )}
                            >
                              {v.sizeName}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <span className="text-xs font-bold block mb-1.5">
                    Quantity: <span className="font-normal">{designQty.toLocaleString()} pieces</span>
                  </span>
                  <div className="flex gap-1.5 flex-wrap mb-sp-3">
                    {DESIGN_QTY_OPTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setDesignQty(q)}
                        className={cn(
                          "min-w-[46px] h-8 px-2 grid place-items-center border rounded-sm font-bold text-[12px] transition-colors",
                          q === designQty
                            ? "bg-accent text-white border-accent"
                            : "border-border bg-bg-raised hover:border-text-tertiary",
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  {namedRosterCount > 0 && (
                    <p className="m-0 mb-sp-3 text-xs text-text-secondary">
                      Team list is incomplete — every row needs a name. A single
                      name on one jersey belongs on the Text tab.
                    </p>
                  )}
                </>
              )}

              <div className="mb-sp-3">
                <span className="text-xs font-bold block mb-1.5">Print method</span>
                <StudioSelect
                  tone="panel"
                  ariaLabel="Print method"
                  value={selectedMethod?.key ?? methodKey}
                  onChange={(value) => {
                    const next = quoteMethods.find((method) => method.key === value);
                    setMethodKey(value);
                    setOptionKey(defaultOptionKey(next));
                  }}
                  options={quoteMethods.map((method) => ({
                    value: method.key,
                    label: method.label,
                  }))}
                />
              </div>
              {methodVariableInputs(selectedMethod).colours && (
                <div className="mb-sp-3">
                  <span className="text-xs font-bold block mb-1.5">
                    Colours in the design
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {colourOptions(selectedMethod).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setColours(count)}
                        className={cn(
                          "min-w-8 h-8 px-2 grid place-items-center border rounded-sm font-bold text-[12px] transition-colors",
                          colours === count
                            ? "bg-accent text-white border-accent"
                            : "border-border bg-bg-raised hover:border-text-tertiary",
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {methodVariableInputs(selectedMethod).stitches && (
                <div className="mb-sp-3">
                  <span className="text-xs font-bold block mb-1.5">Logo size</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {STITCH_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setStitchPreset(preset.id)}
                        className={cn(
                          "px-2 h-8 grid place-items-center border rounded-sm font-bold text-[12px] transition-colors",
                          stitchPreset === preset.id
                            ? "bg-accent text-white border-accent"
                            : "border-border bg-bg-raised hover:border-text-tertiary",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedMethod?.rateModel.kind === "matrixByOption" && (
                <div className="mb-sp-3">
                  <span className="text-xs font-bold block mb-1.5">
                    Transfer size
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedMethod.rateModel.options.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setOptionKey(option.key)}
                        className={cn(
                          "px-2 h-8 grid place-items-center border rounded-sm font-bold text-[12px] transition-colors",
                          (optionKey || defaultOptionKey(selectedMethod)) ===
                          option.key
                            ? "bg-accent text-white border-accent"
                            : "border-border bg-bg-raised hover:border-text-tertiary",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {cartError && (
                <p className="text-sm text-danger mt-2 mb-0" role="alert">
                  {cartError}
                </p>
              )}

              <Button
                type="button"
                className="w-full"
                variant="primary"
                disabled={
                  addingToCart ||
                  !selectedColorwayReady ||
                  (!teamOrderReady &&
                    (!selectedVariant?.active || (selectedVariant?.qty ?? 0) <= 0))
                }
                onClick={addDesignToCart}
              >
                {addingToCart
                  ? "Attaching artwork…"
                  : !selectedColorwayReady
                    ? "Loading colour…"
                  : teamOrderReady
                    ? `Add ${roster.length.toLocaleString()} Piece${roster.length === 1 ? "" : "s"} to Cart · ${placementSuffix}`
                    : !selectedVariant || selectedVariant.qty <= 0
                      ? "Unavailable"
                      : `Add ${designQty.toLocaleString()} Piece${designQty === 1 ? "" : "s"} to Cart · ${placementSuffix} · ${moneyFromMinor(
                          quoted?.totalMinor ??
                            unitPriceMinor(selectedVariant, designQty, productDetail) *
                              designQty,
                        )}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

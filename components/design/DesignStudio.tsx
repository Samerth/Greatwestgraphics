"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Type as TypeIcon,
  Users as UsersIcon,
  StickyNote as StickyNoteIcon,
} from "lucide-react";
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
  type SideDecoration,
  type TextAlign,
  type TextPrintMethod,
} from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { trackCartItemAdded } from "@/lib/analytics/gtag";
import { useCartStore } from "@/lib/store/cart";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import { useDesignOrderStore } from "@/lib/store/design-order";
import { DesignStepBar } from "@/components/design/DesignStepBar";
import {
  placeholderHaloFor,
  ROSTER_NAME_PLACEHOLDER,
  ROSTER_NUMBER_PLACEHOLDER,
  pixelsPerInch,
  rosterActiveSides,
  rosterPreviewOffsetFromPosition,
  rosterPreviewPlacement,
  rosterPreviewSideFor,
} from "@/lib/commerce/studio-roster-preview";
import {
  rosterLooksStarted,
  usePdpStudioHandoff,
} from "@/lib/store/pdp-studio-handoff";
import {
  artworkSrcForDraft,
  dataUrlToBlob,
  filenameForArtworkBlob,
} from "@/lib/store/design-draft";
import {
  PRICING_MASTER_V2,
  type GarmentPriceCurve,
} from "@gwg/pricing";
import {
  STITCH_PRESET_DISCLAIMER,
  STITCH_PRESETS,
  colourOptions,
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
  stitchCountForPreset,
  type StitchPresetId,
} from "@/lib/utils/shop-quote";
import {
  allowedDesignSides,
  filterAllowedMethods,
  resolveSideDecoration,
  withSideDecoration,
} from "@/lib/commerce/studio-decoration";
import { type RosterRow } from "@/components/shared/RosterEditor";
import { SHOW_DESIGN_STUDIO_AI_CONCEPT } from "@/lib/features";
import {
  framedBackdropStyles,
  garmentBackdrops,
  isStudioSideRepresentation,
  studioBackdropFallbackUrl,
  studioCanvasImageUrl,
} from "@/lib/commerce/garment-backdrop";
import {
  STUDIO_PRINT_AREAS,
  cartPrintMetaLabel,
  decoratedDesignSides,
  frontChestZoneForAlign,
  placeArtworkInZone,
} from "@/lib/commerce/studio-placement";
import { STUDIO_DEFAULT_FONT_ID } from "@/lib/commerce/studio-fonts";
import {
  createStudioHistory,
  type StudioHistorySnapshot,
} from "@/lib/commerce/studio-history";
import {
  alignStudioLayer,
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
import {
  patchRosterDecor,
  type RosterDecorTarget,
} from "@/lib/commerce/studio-roster-decor";
import {
  studioActiveTeamRows,
  studioCartLineFields,
  studioCartRosterPayload,
  studioFinishMode,
  withDefaultRosterSizes,
} from "@/lib/commerce/studio-cart-roster";
import { StudioSelect } from "@/components/design/StudioSelect";
import { StudioArticlePicker } from "@/components/design/StudioArticlePicker";
import { StudioColorSwitcher } from "@/components/design/StudioColorSwitcher";
import { GarmentBackdropImage } from "@/components/design/GarmentBackdropImage";
import { StudioFontLoader } from "@/components/design/StudioFontLoader";
import { StudioTextPanel } from "@/components/design/StudioTextPanel";
import {
  StudioChestAlign,
  StudioElementEditor,
} from "@/components/design/StudioElementEditor";
import { StudioTeamOrderPanel } from "@/components/design/StudioTeamOrderPanel";
import { StudioNotesTab } from "@/components/design/StudioNotesTab";
import { GarmentSizeChartModal } from "@/components/shared/GarmentSizeChartModal";
import {
  studioArticleLabel,
  studioColorwaysForArticle,
  studioDetailColorwaysForSelection,
  studioGarmentPhotos,
  studioRosterSizeOptions,
  studioVariantIdForColorway,
  uniqueStudioArticles,
} from "@/lib/commerce/studio-garments";
import {
  DESIGN_SIDE_THUMB_LABELS,
  isStudioSleeveSide,
  studioSleeveFillFromColorway,
  studioVisiblePlateTint,
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
  styleTitle?: string | null;
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
// unitPriceMinor was removed with the studio's live price: the studio no
// longer has a quantity to price against. The Input Quantity step prices
// the order through the shared pricing engine.

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
    title?: string | null;
    styleImageUrl: string | null;
    sizeSpecs?: unknown;
  };
  variants: ProductDetailVariant[];
  colorways?: ProductDetailColorway[];
  sizeSpecs?: unknown;
  pricingConfig?: PricingConfigV2;
  /** Admin-configured allow-list from this product's categories (CodSphere
   * UAT — "Product-Specific Decoration Methods & Print Locations"). `null`
   * for either means unrestricted. */
  decorationRules?: { methods: string[] | null; locations: string[] | null };
};

const STUDIO_TABS = [
  { id: "images", label: "Images", Icon: ImageIcon },
  { id: "text", label: "Text", Icon: TypeIcon },
  { id: "team", label: "Names", Icon: UsersIcon },
  { id: "notes", label: "Notes", Icon: StickyNoteIcon },
] as const;
type StudioTab = (typeof STUDIO_TABS)[number]["id"];
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
// Tier name only in the dropdown — stitch counts are an explanatory mapping,
// not something a customer should have to read off a label (CodSphere UAT:
// "Customer facing dropdown should display only the tier name").
const STITCH_LABELS: Record<StitchPresetId, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  oversized: "Oversized",
};

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

/** The PDP's location vocabulary (front/back/leftChest/sleeve) is
 * finer-grained than the studio's four canvas sides — map down to the
 * closest one as a starting point; the customer can still switch sides
 * freely once inside the studio. */
function pdpLocationToDesignSide(location: string): DesignSide {
  if (location === "back") return "back";
  if (location === "leftChest" || location === "sleeve") return "left";
  return "front";
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
function nextPollinationsSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

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
  /** "Rendering Back (2/3)…" while downloadMockup cycles through every
   * decorated side to build one combined sheet — a multi-second operation
   * since each side needs its own render pass on the live canvas. */
  const [exportingMockup, setExportingMockup] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [showDecorationSizeGuide, setShowDecorationSizeGuide] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    initialDesign?.garmentProductId ?? garmentIdOverride ?? null,
  );
  const [changingGarment, setChangingGarment] = useState(false);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  // Which methods this product's category actually allows (CodSphere UAT —
  // "Product-Specific Decoration Methods & Print Locations", e.g. Hats
  // should not offer Screen Print). `null` from the API means unrestricted.
  const quoteMethods = useMemo(
    () =>
      filterAllowedMethods(
        enabledDecorationMethods(pricingConfig),
        productDetail?.decorationRules?.methods,
      ),
    [pricingConfig, productDetail],
  );
  const [methodKey, setMethodKey] = useState(
    () =>
      quoteMethods.find(
        (method) => method.key === pricingConfig.storefront?.defaultMethodKey,
      )?.key ??
      quoteMethods[0]?.key ??
      "screenPrint",
  );
  // Quotes still need a colour count. Do not render ink-count chips in the
  // finish panel — shoppers read those as garment colour, not screen count.
  const [colours, setColours] = useState(
    pricingConfig.storefront?.defaultColours ?? 1,
  );
  const [stitchPreset, setStitchPreset] = useState<StitchPresetId>("medium");
  const [optionKey, setOptionKey] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>(() =>
    initialDesign
      ? rosterRowsFromDesign(normalizeDesignDocument(initialDesign.design))
      : [{ size: "", name: "", number: "" }],
  );
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [selectedRosterTarget, setSelectedRosterTarget] =
    useState<RosterDecorTarget | null>(null);
  // `activeSide` changes from many places (thumbnail clicks, the location
  // auto-follow below, undo/redo). A selected mark on a side that is no
  // longer showing would leave stale, invisible resize handles armed, so
  // this clears on every side change rather than trying to thread the
  // clear through each caller individually.
  useEffect(() => {
    setSelectedRosterTarget(null);
  }, [activeSide]);
  const [studioTab, setStudioTab] = useState<StudioTab>("images");
  const [teamPanelReveal, setTeamPanelReveal] = useState(0);
  const [textDraft, setTextDraft] = useState("");
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
  const [textPrintMethod, setTextPrintMethod] = useState<TextPrintMethod>("print");
  const [textFill, setTextFill] = useState("#111111");
  const [textFontId, setTextFontId] = useState(STUDIO_DEFAULT_FONT_ID);
  const [zoom, setZoom] = useState(1);
  const [liveZone, setLiveZone] = useState<string | null>(null);
  const [historyFlags, setHistoryFlags] = useState({
    canUndo: false,
    canRedo: false,
  });
  const historyRef = useRef(createStudioHistory());
  const sliderHistoryArmedRef = useRef(false);
  const designRef = useRef(design);

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
  const hasAnyDecoration =
    decoratedDesignSides(artworksBySide, textsBySide).length > 0;
  const sideLayerCount = (side: DesignSide) =>
    artworksBySide[side].length + (textsBySide[side]?.length ?? 0);

  /**
   * Every distinct image the customer has uploaded anywhere in this design,
   * so it can be reused on another side without re-uploading from disk.
   * Deliberately derived from `artworksBySide` rather than tracked as its
   * own list: an upload that has been placed is already sitting in that map,
   * and one that's since been deleted from every side should stop being
   * offered — there is nothing extra to keep in sync or garbage-collect.
   * Still-uploading (blob:/data:) sources are excluded because that URL is
   * either about to be swapped for a hosted one or dies with the tab; a
   * second placement pointing at it would not survive a reload.
   */
  const reusableUploads = useMemo(() => {
    const seen = new Map<string, PlacedArtwork>();
    for (const side of DesignSides) {
      for (const artwork of artworksBySide[side]) {
        if (isDurableArtworkSrc(artwork.src) && !seen.has(artwork.src)) {
          seen.set(artwork.src, artwork);
        }
      }
    }
    return [...seen.values()];
  }, [artworksBySide]);

  /**
   * Places an already-uploaded image onto the active side as a new, fully
   * independent layer — same code path as a fresh upload from here down,
   * just skipping the file picker and the network round-trip since the file
   * is already hosted. Re-measures natural size rather than trusting the
   * source layer's, since a different side's print zone can call for a
   * different starting scale.
   */
  async function reuseArtwork(source: PlacedArtwork) {
    const side = activeSide;
    const zone = placementBySide[side];
    let imageWidth = 1024;
    let imageHeight = 1024;
    try {
      const size = await measureArtworkSize(source.src);
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
      id: crypto.randomUUID(),
      src: source.src,
      ...placed,
      rotation: 0,
      ...(source.outline ? { outline: source.outline } : {}),
      ...(source.outlineColor ? { outlineColor: source.outlineColor } : {}),
    };
    setActiveArtworks((prev) => [...prev, newArtwork]);
    setSelectedId(newArtwork.id);
  }

  useEffect(() => {
    designRef.current = design;
  }, [design]);

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

  // Size preference, decoration choices and a roster started on the product
  // page follow "Design this". Quantity does not — see below.
  useEffect(() => {
    if (isStaff || !garmentIdOverride || initialDesign) return;
    const applyHandoff = () => {
      const handoff = usePdpStudioHandoff.getState().handoff;
      if (!handoff || handoff.productId !== garmentIdOverride) return;
      if (handoff.sizeName) preferredSizeNameRef.current = handoff.sizeName;
      // handoff.qty is intentionally not applied here any more. The product
      // page's estimate quantity is a single total; the Input Quantity step
      // asks for a breakdown by size and colour, so there is nowhere in the
      // studio for it to live. It stays on the handoff for whichever step
      // wants to seed from it later.
      if (handoff.methodKey) setMethodKey(handoff.methodKey);
      if (handoff.colours) setColours(handoff.colours);
      if (handoff.stitchPreset) {
        setStitchPreset(handoff.stitchPreset as StitchPresetId);
      }
      if (handoff.optionKey) setOptionKey(handoff.optionKey);
      if (handoff.location) {
        setActiveSide(pdpLocationToDesignSide(handoff.location));
      }
      // The full multi-row selection, not just the primary one: a customer
      // who built Screen Print/Front + Embroidery/Sleeve on the PDP's Live
      // Estimate Calculator opens the studio with both already set, not
      // just the first row (CodSphere UAT — carries the complete decoration
      // configuration into Design Studio). Two PDP rows that map onto the
      // same studio side (e.g. Left Chest and Sleeve both collapse onto
      // "left") means the later row wins — the same limitation the single-
      // row handoff already had, just no longer silently dropping the rest.
      if (handoff.decorations && handoff.decorations.length > 0) {
        setDesign((prev) => {
          let next = prev;
          for (const row of handoff.decorations!) {
            const side = pdpLocationToDesignSide(row.location);
            next = withSideDecoration(
              next,
              side,
              {
                methodKey: row.methodKey,
                colours: row.colours,
                stitchPreset: row.stitchPreset,
                optionKey: row.optionKey,
              },
              { methodKey: row.methodKey },
            );
          }
          return next;
        });
      }
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
      styleTitle: productDetail.style.title,
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
  const [showSizeChart, setShowSizeChart] = useState(false);
  // Opens inline via StudioSizeChartModal instead of navigating to the PDP's
  // #size-chart anchor -- that used to take the shopper off the studio
  // entirely to view a table, abandoning whatever they had in progress.
  const sizeChart = useMemo(() => {
    if (!selectedGarmentId || !productDetail || !selectedColorwayReady) {
      return null;
    }
    return readProductSizeChart(productDetail);
  }, [productDetail, selectedGarmentId, selectedColorwayReady]);

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
  const defaultRosterSize =
    selectedVariant?.sizeName ??
    productDetail?.variants.find(
      (variant) => variant.qty > 0 && variant.active !== false,
    )?.sizeName ??
    productDetail?.variants[0]?.sizeName ??
    "";

  useEffect(() => {
    if (!defaultRosterSize) return;
    setRoster((prev) => {
      const next = withDefaultRosterSizes(prev, defaultRosterSize);
      if (next === prev) return prev;
      setDesign((current) => ({
        ...current,
        roster: next
          .filter((row) => row.name.trim() || row.number.trim() || row.size)
          .map((row) => ({
            size: row.size,
            name: row.name,
            number: row.number.trim() || undefined,
          })),
      }));
      return next;
    });
  }, [defaultRosterSize]);

  const rosterPlayerCount = studioActiveTeamRows(roster).length;
  const finishMode = studioFinishMode(roster);
  const teamOrderReady = finishMode === "team-ready";
  const teamOrderStarted = finishMode !== "bulk";
  const selectedMethod =
    quoteMethods.find((method) => method.key === methodKey) ?? quoteMethods[0];
  const decoratedSides = decoratedDesignSides(
    artworksBySide,
    textsBySide,
    rosterActiveSides(rosterDecor, studioActiveTeamRows(roster).length > 0),
  );

  // Decoration method + pricing input, independent per side (CodSphere UAT
  // V2, "Decoration Method, Location & Pricing Inputs"). `methodKey` /
  // `colours` / `stitchPreset` / `optionKey` above are the studio-wide
  // default — seeded from the PDP handoff — that a side falls back to until
  // the customer explicitly picks something for it.
  const decorationFallback: SideDecoration = {
    methodKey,
    colours,
    stitchPreset,
    optionKey: optionKey || undefined,
  };
  const activeDecoration = resolveSideDecoration(design, activeSide, decorationFallback);
  const activeDecorationMethod =
    quoteMethods.find((method) => method.key === activeDecoration.methodKey) ??
    quoteMethods[0];
  const activeDecorationFields = methodVariableInputs(activeDecorationMethod);

  function updateActiveSideDecoration(patch: Partial<SideDecoration>) {
    setDesign((prev) =>
      withSideDecoration(prev, activeSide, patch, decorationFallback),
    );
  }

  /**
   * "EXAMPLE" / "00" marks for the side currently on screen, so the customer
   * can see where each person's name and number will print — and watch it
   * move as they change the height or location — instead of only reading it
   * in the panel. Only shown once at least one person is on the roster: an
   * empty roster is not a personalised order, and a placeholder on a plain
   * garment would just be confusing.
   */
  const rosterPreviewMarks = useMemo(() => {
    if (studioActiveTeamRows(roster).length === 0) return [];
    const marks: {
      target: RosterDecorTarget;
      text: string;
      centerX: number;
      centerY: number;
      fontSize: number;
      color: string;
      halo: string;
      renderOffsetY: number;
    }[] = [];
    const parts: [RosterDecorTarget, typeof rosterDecor.names, string][] = [
      ["names", rosterDecor.names, ROSTER_NAME_PLACEHOLDER],
      ["numbers", rosterDecor.numbers, ROSTER_NUMBER_PLACEHOLDER],
    ];
    for (const [target, part, text] of parts) {
      if (!part.enabled) continue;
      const placed = rosterPreviewPlacement(
        part.location,
        part.heightIn,
        CANVAS_SIZE,
        { xNorm: part.offsetXNorm, yNorm: part.offsetYNorm },
      );
      if (!placed || placed.side !== activeSide) continue;
      marks.push({
        target,
        text,
        centerX: placed.centerX,
        centerY: placed.centerY,
        fontSize: placed.fontSize,
        color: part.color,
        halo: placeholderHaloFor(part.color),
        renderOffsetY: 0,
      });
    }
    // Names above numbers when both land on the same spot, matching how a
    // jersey actually reads. Applied as a render-only nudge (not baked into
    // centerY) so dragging either mark reports its true, un-stacked
    // position — otherwise the first drag after a collision would silently
    // adopt the stacking nudge as a permanent offset.
    if (marks.length === 2 && Math.abs(marks[0]!.centerY - marks[1]!.centerY) < 1) {
      marks[0]!.renderOffsetY = -marks[0]!.fontSize * 0.8;
      marks[1]!.renderOffsetY = marks[1]!.fontSize * 0.4;
    }
    return marks;
  }, [roster, rosterDecor, activeSide]);

  /**
   * Names and numbers each have their own Location, independently of one
   * another — matching the Coastal Reign benchmark and the client's own
   * spec ("independently for each artwork/decoration location"). That is
   * exactly what produced real, repeated confusion in testing: the two
   * marks split across Front and Back with nothing on screen explaining
   * why the one you expected was not where you were looking. This makes
   * that visible instead of silent — a small, dismissable line naming
   * where the other one actually is, with a one-click jump.
   */
  const rosterMarksElsewhere = useMemo(() => {
    if (studioActiveTeamRows(roster).length === 0) return [];
    const parts: [RosterDecorTarget, typeof rosterDecor.names, string][] = [
      ["names", rosterDecor.names, "Names"],
      ["numbers", rosterDecor.numbers, "Numbers"],
    ];
    const elsewhere: { target: RosterDecorTarget; label: string; side: DesignSide }[] = [];
    for (const [target, part, label] of parts) {
      if (!part.enabled) continue;
      const side = rosterPreviewSideFor(part.location);
      if (side && side !== activeSide) elsewhere.push({ target, label, side });
    }
    return elsewhere;
  }, [roster, rosterDecor, activeSide]);

  /**
   * Converts a drop position back into a saved offset and commits it.
   *
   * Uses `setDesign` directly rather than `commitDesign` (no undo-history
   * push), matching `onDecorChange` just below — the whole roster-decor
   * panel treats these settings as live-adjustable state, not an
   * undo/redo-tracked edit, and a drag is the same kind of change as
   * dragging the Height slider or picking a new Location.
   */
  function handleRosterPreviewDragEnd(
    target: RosterDecorTarget,
    droppedX: number,
    droppedY: number,
  ) {
    const part = rosterDecor[target];
    const offset = rosterPreviewOffsetFromPosition(
      part.location,
      CANVAS_SIZE,
      droppedX,
      droppedY,
    );
    if (!offset) return;
    setDesign((prev) => ({
      ...prev,
      rosterDecor: patchRosterDecor(prev.rosterDecor ?? defaultRosterDecor(), target, {
        offsetXNorm: offset.xNorm,
        offsetYNorm: offset.yNorm,
      }),
    }));
  }

  /**
   * Converts a resize-handle result (raw rendered pixels) into a saved
   * height in inches plus a repositioned offset, and commits both together.
   *
   * Repositioning matters here in a way it does not for a plain drag: a
   * corner-anchored resize moves the *opposite* corner's world position
   * even though the customer only touched one handle, so the mark's centre
   * genuinely shifts as a side effect of resizing. Saving only the new
   * height and letting the next render recompute position from the old
   * offset would snap the mark to a different spot than the one the
   * customer just saw and released it at.
   */
  function handleRosterPreviewResizeEnd(
    target: RosterDecorTarget,
    renderedHeightPx: number,
    centerX: number,
    centerY: number,
  ) {
    const part = rosterDecor[target];
    const offset = rosterPreviewOffsetFromPosition(
      part.location,
      CANVAS_SIZE,
      centerX,
      centerY,
    );
    if (!offset) return;
    const heightIn = renderedHeightPx / pixelsPerInch(CANVAS_SIZE);
    // Same bounds the schema enforces (RosterDecorPartSchema: 0.25"–12") —
    // clamped here too so a resize can never produce a value the document
    // would then fail to save.
    const clampedHeightIn = Math.min(12, Math.max(0.25, heightIn));
    setDesign((prev) => ({
      ...prev,
      rosterDecor: patchRosterDecor(prev.rosterDecor ?? defaultRosterDecor(), target, {
        heightIn: clampedHeightIn,
        offsetXNorm: offset.xNorm,
        offsetYNorm: offset.yNorm,
      }),
    }));
  }

  // The design document carries what the artwork looks like; it does not
  // carry how it is to be decorated. Mirror that alongside it so the Input
  // Quantity step can price the order without making the customer choose a
  // method a second time. Sits below `selectedMethod` rather than beside the
  // design-store effect above because it reads it.
  useEffect(() => {
    if (isStaff) return;
    if (!hasActiveArtwork(design)) return;
    const order = useDesignOrderStore.getState();
    order.setGarment(selectedGarmentId);
    order.setDecoration({
      methodKey,
      optionKey: optionKey || defaultOptionKey(selectedMethod),
      stitchPreset,
      colours: methodVariableInputs(selectedMethod).colours ? colours : null,
    });
    // Names and numbers travel too — they are printed on the garment, so
    // they belong to the design. Sizes deliberately do not: the Input
    // Quantity step asks for those alongside every other quantity.
    order.setNames(
      roster
        .filter((row) => row.name.trim() !== "" || (row.number ?? "").trim() !== "")
        .map((row) => ({ name: row.name, number: row.number ?? "" })),
    );
  }, [
    design,
    selectedGarmentId,
    methodKey,
    optionKey,
    stitchPreset,
    colours,
    selectedMethod,
    roster,
    isStaff,
  ]);

  // The live price memo lived here. Pricing belongs to the Input Quantity
  // step now — the studio has no quantity or size to price against, so any
  // number it produced would be a guess. Removed rather than left computing
  // a value nothing reads.

  // Front/back stay the vendor photos. Sleeves use a vendor side shot
  // when the catalog has one, otherwise a photorealistic 3/4 side plate
  // tinted to the colourway — never a crop of the chest photo.
  const garmentPhotos = studioGarmentPhotos({
    selectedId: selectedGarmentId,
    product: productDetail?.product,
    styleImageUrl: productDetail?.style.styleImageUrl,
    styleName:
      selectedGarment?.styleName ?? productDetail?.style.styleName ?? null,
    styleTitle:
      selectedGarment?.styleTitle ?? productDetail?.style.title ?? null,
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
    backdrop.source === "side-view"
      ? studioVisiblePlateTint(sleeveFillHex)
      : undefined;
  const currentPhoto = studioCanvasImageUrl(backdrop);
  const mirrorPhoto = backdrop.mirror;
  const isLoadingGarment = Boolean(selectedGarmentId) && !productDetail;
  const canvasGarmentImageUrl = studioCanvasImageUrl(backdrop);
  const framedBackdrop = framedBackdropStyles(backdrop);

  // All four views are offered by default — a sleeve print is a real thing
  // a customer orders whether or not the vendor photographed that angle,
  // and the artwork is stored per view either way — narrowed only when this
  // product's category actually restricts which locations apply (CodSphere
  // UAT — e.g. Bags should not offer sleeve prints at all).
  const decorationLocationsRule = productDetail?.decorationRules?.locations;
  const decorationLocationsRuleKey = decorationLocationsRule?.join(",") ?? "";
  const availableViews = useMemo(
    () => allowedDesignSides(decorationLocationsRule) ?? DesignSides,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decorationLocationsRuleKey],
  );

  // The side on screen must always be one the thumbnail rail actually
  // offers — a customer viewing a sleeve who then switches to a Bag (no
  // sleeve locations allowed) would otherwise be left on a side with no
  // way back to it.
  useEffect(() => {
    if (!availableViews.includes(activeSide) && availableViews[0]) {
      setActiveSide(availableViews[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableViews]);

  function setSelectedId(id: string | null) {
    setSelectedBySide((prev) => ({ ...prev, [activeSide]: id }));
    // One thing selected at a time: picking a real artwork/text layer
    // clears any selected roster mark, the same way selecting a roster mark
    // clears this (see the DesignCanvas onSelect wiring below).
    if (id !== null) setSelectedRosterTarget(null);
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
    setHistoryFlags({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
    setExportError(null);
  }

  function undoStudio() {
    const prev = designRef.current;
    const restored = historyRef.current.undo(snapshotOf(prev));
    if (!restored) return;
    const next = applyHistorySnapshot(prev, restored);
    designRef.current = next;
    setDesign(next);
    setHistoryFlags({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
    setLiveZone(null);
  }

  function redoStudio() {
    const prev = designRef.current;
    const restored = historyRef.current.redo(snapshotOf(prev));
    if (!restored) return;
    const next = applyHistorySnapshot(prev, restored);
    designRef.current = next;
    setDesign(next);
    setHistoryFlags({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
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
    if (!Number.isFinite(placed.scaleX) || !Number.isFinite(placed.scaleY)) {
      // A NaN/Infinite scale here renders as artwork at its raw natural
      // pixel size (Konva ignores an invalid transform), which is exactly
      // "expands to fill the canvas" from the customer's side — logging the
      // real inputs is the only way to catch what actually produced it,
      // since every deliberately-malformed test file reproduced so far has
      // placed correctly.
      console.error("[design-studio] non-finite artwork placement", {
        side,
        zone,
        imageWidth,
        imageHeight,
        canvasSize: CANVAS_SIZE,
        placed,
        filename,
      });
    }

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
    setHistoryFlags({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
  }

  function endSliderHistory() {
    sliderHistoryArmedRef.current = false;
    setHistoryFlags({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
  }

  function patchSelectedWhileSliding(textPatch?: Partial<PlacedText>, artPatch?: Partial<PlacedArtwork>) {
    beginSliderHistory();
    if (textPatch) applySelectedTextPatch(textPatch, false);
    if (artPatch) applySelectedArtworkPatch(artPatch, false);
  }

  function setRosterRows(rows: RosterRow[]) {
    const next = withDefaultRosterSizes(rows, defaultRosterSize);
    setRoster(next);
    setRosterError(null);
    setDesign((prev) => ({
      ...prev,
      roster: next
        .filter((row) => row.name.trim() || row.number.trim() || row.size)
        .map((row) => ({
          size: row.size,
          name: row.name,
          number: row.number.trim() || undefined,
        })),
    }));
  }

  function revealTeamPanel() {
    setStudioTab("team");
    setTeamPanelReveal((tick) => tick + 1);
  }

  useEffect(() => {
    if (!teamPanelReveal) return;
    document.getElementById("studio-team-order")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [teamPanelReveal]);

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
    const seed = nextPollinationsSeed();
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
    } catch (caught) {
      // Genuinely rare (a tainted canvas from a garment host missing CORS
      // headers, most likely), but silent failure here is exactly what
      // made the original bug hard to diagnose — this costs nothing and
      // gives support something to go on from a customer's own console.
      console.warn("[design-studio] canvas export failed", caught);
      return null;
    } finally {
      transformers.forEach((node: { show: () => void }) => node.show());
      stage.batchDraw();
    }
  }

  /** Two animation frames reliably land after react-konva's own commit +
   * paint for a freshly-mounted Stage (the Stage remounts on every side
   * change via `key={activeSide}`), and the extra fixed delay covers the
   * async image fetch inside GarmentBackdropImage/ArtworkLayer's useImage
   * — normally near-instant since the browser already cached these exact
   * URLs from the always-visible side thumbnails, but not guaranteed to be
   * synchronous. */
  function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Warms the browser cache for every decorated side's garment photo, in
   * parallel, before the capture loop below switches to any of them. The
   * per-side switch-then-retry loop was discovering "this image isn't
   * decoded yet" one side at a time, serially — the slowest side to load
   * (often whichever hadn't been visited recently) could still lose the
   * race against a fixed per-attempt timeout. Loading everything up front,
   * all at once, means the switch loop is usually hitting an already-warm
   * cache instead of racing a fresh fetch. Best-effort: a slow or failed
   * preload here doesn't block the export — the existing retry loop is
   * still the fallback if a particular side genuinely isn't ready. */
  function preloadSideImages(sides: DesignSide[]): Promise<void> {
    return Promise.all(
      sides.map(
        (side) =>
          new Promise<void>((resolve) => {
            const url = studioCanvasImageUrl(sideBackdrops[side]);
            if (!url) {
              resolve();
              return;
            }
            const img = new Image();
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            const sameOrigin =
              (url.startsWith("/") && !url.startsWith("//")) ||
              url.startsWith("data:") ||
              url.startsWith("blob:");
            if (!sameOrigin) img.crossOrigin = "anonymous";
            img.src = url;
            // Don't let one unreachable host hold up the whole export.
            setTimeout(done, 4000);
          }),
      ),
    ).then(() => undefined);
  }

  /** One combined sheet with every decorated side, not just whichever side
   * happened to be on screen (CodSphere UAT: "Download Front Mockup" only
   * downloaded the current view; the client wants "a complete
   * representation of the customer's design"). Temporarily switches
   * activeSide to capture each one off the same live canvas the single-side
   * export already used, then restores the side the customer was on. */
  async function downloadMockup() {
    const sides = decoratedDesignSides(artworksBySide, textsBySide);
    if (sides.length === 0) {
      setExportError("Add artwork or text to the design first.");
      return;
    }
    setExportError(null);
    setExportingMockup("Preparing garment views…");
    await preloadSideImages(sides);
    const startingSide = activeSide;
    // Tracks the side actually on screen as the loop drives it — not the
    // `activeSide` state variable, which stays frozen at whatever it was
    // when this closure was created for the rest of the loop (a `setState`
    // call doesn't change the value already captured here). Comparing
    // against the stale state variable meant every switch after the first
    // was silently skipped, capturing the previous side's canvas again
    // under the next side's label.
    let currentSide = activeSide;
    const captured: { side: DesignSide; dataUrl: string }[] = [];
    const failed: DesignSide[] = [];

    try {
      for (let i = 0; i < sides.length; i += 1) {
        const side = sides[i]!;
        setExportingMockup(`Rendering ${DESIGN_SIDE_LABELS[side]} (${i + 1}/${sides.length})…`);
        if (side !== currentSide) {
          setActiveSide(side);
          currentSide = side;
          await nextFrame();
          await wait(300);
        }
        // A freshly-mounted Stage's garment photo (the Stage remounts on
        // every side change) can still be finishing its fetch/decode even
        // after a render tick and a fixed delay — retry with backoff
        // rather than failing the whole sheet over one slow image.
        let dataUrl: string | null = null;
        for (let attempt = 0; attempt < 4 && !dataUrl; attempt += 1) {
          if (attempt > 0) await wait(400 * attempt);
          dataUrl = exportStageDataUrl();
        }
        // One stubborn side (still not decoded, or a garment photo whose
        // host doesn't answer with the CORS header canvas export needs)
        // shouldn't cost the customer every other view they already
        // finished — skip it and keep going, rather than aborting the
        // whole sheet the way a single thrown error used to.
        if (dataUrl) captured.push({ side, dataUrl });
        else failed.push(side);
      }

      if (captured.length === 0) {
        throw new Error(
          "The mockup could not be rendered. Wait for the garment and artwork to finish loading, then try again.",
        );
      }

      // Single-side mockups keep the old plain download; multi-side ones
      // get composited into one sheet so proofing is one file, not several.
      const finalDataUrl =
        captured.length === 1
          ? captured[0]!.dataUrl
          : await composeMockupSheet(captured);

      const link = document.createElement("a");
      link.href = finalDataUrl;
      link.download = "great-west-graphics-mockup.png";
      link.click();

      if (failed.length > 0) {
        setExportError(
          `Downloaded ${captured.map((c) => DESIGN_SIDE_LABELS[c.side]).join(", ")}. ` +
            `${failed.map((s) => DESIGN_SIDE_LABELS[s]).join(", ")} could not be rendered this time — try downloading again in a moment.`,
        );
      }
    } catch (caught) {
      setExportError(
        caught instanceof Error
          ? caught.message
          : "The mockup could not be rendered. Wait for the garment and artwork to finish loading, then try again.",
      );
    } finally {
      if (currentSide !== startingSide) setActiveSide(startingSide);
      setExportingMockup(null);
    }
  }

  /** Lays captured side renders left-to-right in a single row (each already
   * a square canvas at 2x pixel ratio), with a caption under each so it's
   * unambiguous which view is which on a printed proof sheet. */
  async function composeMockupSheet(
    captured: { side: DesignSide; dataUrl: string }[],
  ): Promise<string> {
    const images = await Promise.all(
      captured.map(
        ({ dataUrl }) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Could not compose the mockup sheet."));
            img.src = dataUrl;
          }),
      ),
    );
    const tileSize = Math.max(...images.map((img) => img.width));
    const captionHeight = Math.round(tileSize * 0.06);
    const gap = Math.round(tileSize * 0.03);
    const canvas = document.createElement("canvas");
    canvas.width = images.length * tileSize + (images.length - 1) * gap;
    canvas.height = tileSize + captionHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not compose the mockup sheet.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#111111";
    ctx.font = `${Math.round(captionHeight * 0.55)}px sans-serif`;
    images.forEach((img, i) => {
      const x = i * (tileSize + gap);
      ctx.drawImage(img, x, 0, tileSize, tileSize);
      ctx.fillText(
        DESIGN_SIDE_LABELS[captured[i]!.side],
        x + tileSize / 2,
        tileSize + captionHeight * 0.7,
      );
    });
    return canvas.toDataURL("image/png");
  }

  /**
   * Step 1's exit. Renders and uploads the proof here, while the canvas
   * still exists, because the Input Quantity step has no stage of its own —
   * and a design that arrives at checkout with no proof is exactly how
   * orders used to reach production blank.
   *
   * A failed upload does not block the customer: the design document itself
   * still travels, and the durable artwork URL is enough for staff to work
   * from, so this degrades rather than dead-ends.
   */
  async function continueToQuantity() {
    setContinuing(true);
    try {
      let proofUrl: string | null = null;
      try {
        proofUrl = (await uploadProofImage()) ?? firstDurableArtworkUrl(design) ?? null;
      } catch {
        proofUrl = firstDurableArtworkUrl(design) ?? null;
      }

      let projectId = savedDesignId ?? null;
      if (signedIn && (createUrl || (updateUrl && savedDesignId))) {
        try {
          const name = designName.trim() || defaultDesignName();
          if (!designName.trim()) setDesignName(name);
          projectId = (await persistDesign(name, proofUrl)) ?? projectId;
        } catch {
          // Saving is a convenience here, not a gate — the design is already
          // mirrored into the browser store that step 2 reads.
        }
      }

      useDesignOrderStore.getState().setProof({
        proofUrl,
        designProjectId: projectId,
      });
      router.push("/design/quantity");
    } finally {
      setContinuing(false);
    }
  }

  // addDesignToCart lived here. The Input Quantity step owns the cart now,
  // for plain and named orders alike, so the studio no longer builds cart
  // lines at all. Removed rather than left unreachable: a 177-line function
  // nothing calls is a trap for the next reader. See git history if the old
  // single-line-per-order behaviour is ever needed again.

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


  const canUndo = historyFlags.canUndo;
  const canRedo = historyFlags.canRedo;
  const chestGuides = frontChestGuideRects();
  const draggingOnFront = liveZone !== null && activeSide === "front";
  const frontAlign =
    activeSide === "front"
      ? placementBySide.front === "Left Chest"
        ? "left"
        : placementBySide.front === "Right Chest"
          ? "right"
          : placementBySide.front === "Center Chest"
            ? "center"
            : null
      : null;

  function applyAlign(alignX: "left" | "center" | "right") {
    const zone = frontChestZoneForAlign(alignX);
    const artworkToSnap =
      selectedArtwork ??
      (selectedText
        ? null
        : artworks.length === 1
          ? artworks[0]
          : null);

    if (activeSide === "front" && artworkToSnap) {
      void (async () => {
        let imageWidth = 80;
        let imageHeight = 80;
        try {
          const size = await measureArtworkSize(artworkToSnap.src);
          imageWidth = size.width;
          imageHeight = size.height;
        } catch {
          // Assumed square still lands the mark inside the 5×5 box.
        }
        const placed = placeArtworkInZone({
          side: "front",
          zone,
          imageWidth,
          imageHeight,
          canvasSize: CANVAS_SIZE,
        });
        commitDesign((prev) => ({
          ...patchStudioArtwork(prev, artworkToSnap.id, placed),
          placementBySide: { ...prev.placementBySide, front: zone },
        }));
      })();
      return;
    }

    if (selectedId) {
      const display = selectedText
        ? estimateTextDisplaySize(
            selectedText.text,
            selectedText.fontSize,
            selectedText.letterSpacing,
          )
        : {
            width: 80 * Math.abs(selectedArtwork?.scaleX ?? 1),
            height: 80 * Math.abs(selectedArtwork?.scaleY ?? 1),
          };
      commitDesign((prev) =>
        alignStudioLayer(
          prev,
          selectedId,
          alignX,
          CANVAS_SIZE,
          display.width,
          display.height,
        ),
      );
      return;
    }

    if (activeSide === "front") {
      commitDesign((prev) => ({
        ...prev,
        placementBySide: {
          ...prev.placementBySide,
          front: zone,
        },
      }));
    }
  }
  const selectedPrintLabel = selectedText
    ? selectedText.printMethod === "embroidery"
      ? "Embroidery"
      : "Print"
    : "Print";
  const zoomIndex = ZOOM_STEPS.findIndex((step) => step >= zoom - 0.001);
  const zoomAt = zoomIndex < 0 ? ZOOM_STEPS.indexOf(1) : zoomIndex;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[4.75rem_minmax(200px,240px)_minmax(0,1fr)] gap-sp-3 items-start">
      <StudioFontLoader />
      {/* Where the customer is in Design → Input Quantity → Review. Spans
          both grid columns rather than wrapping the layout, and is hidden
          for staff, who open the studio to edit a design rather than to
          walk a shopper's checkout. */}
      {!isStaff && (
        <DesignStepBar
          current="design"
          reached={hasActiveArtwork(design) ? "quantity" : "design"}
          className="md:col-span-3 mb-sp-1"
        />
      )}
      {/* Tool rail. A column of its own rather than a strip of tabs inside
          the panel: the panel's whole contents change per tool, so the
          selector reads better beside it than stacked on top of it. On
          mobile it lies flat above the panel, where a vertical rail would
          eat the fold. */}
      <nav
        aria-label="Design tools"
        className="md:sticky md:top-[calc(var(--header-offset)+1rem)] bg-bg-raised border border-border rounded-lg p-1.5 flex md:flex-col gap-1 min-w-0 overflow-x-auto md:overflow-visible"
      >
        {STUDIO_TABS.map((tab) => {
          const active = studioTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (tab.id === "team") revealTeamPanel();
                else setStudioTab(tab.id);
              }}
              className={cn(
                "flex-1 md:flex-none flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2.5 transition-colors min-w-[3.75rem]",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-tertiary hover:bg-fill-subtle-15 hover:text-text-secondary",
              )}
            >
              <tab.Icon
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={active ? 2.4 : 2}
              />
              <span className="text-[10px] font-bold leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Product and artwork controls. Every visible control is interactive. */}
      <aside className="bg-bg-raised border border-border rounded-lg overflow-hidden flex flex-col min-w-0 md:sticky md:top-[calc(var(--header-offset)+1rem)] md:max-h-[calc(100dvh-var(--header-offset)-2rem)] md:overflow-y-auto">
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
        {reusableUploads.length > 0 && (
          <div className="mt-sp-3">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-1.5">
              Your uploads
            </span>
            <p className="m-0 mb-1.5 text-[11px] leading-4 text-text-tertiary">
              Reuse artwork you&apos;ve already uploaded on any other location —
              no need to upload the same file twice.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reusableUploads.map((upload) => {
                const usedHere = artworks.some((a) => a.src === upload.src);
                return (
                  <button
                    key={upload.id}
                    type="button"
                    onClick={() => void reuseArtwork(upload)}
                    title={
                      usedHere
                        ? "Already on this side — click to add another copy"
                        : `Add to ${DESIGN_SIDE_LABELS[activeSide]}`
                    }
                    className="relative h-14 w-14 rounded-md border border-border bg-bg-raised overflow-hidden hover:border-accent transition-colors"
                  >
                    {/* Requests the artwork the same way ArtworkLayer does.
                        This *is* a URL the Konva canvas draws, so loading it
                        here without a CORS mode would let the browser cache
                        an opaque copy and taint the export — the same bug
                        already fixed for garment photos in
                        GarmentBackdropImage. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- needs an explicit crossOrigin to match the canvas; next/image cannot set one */}
                    <img
                      src={upload.src}
                      alt=""
                      crossOrigin={
                        /^(https?:)?\/\//.test(upload.src) ? "anonymous" : undefined
                      }
                      className="h-full w-full object-contain p-1"
                    />
                    {usedHere && (
                      <span className="absolute top-0.5 right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white text-[9px] leading-none">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
                ? `${rosterPlayerCount.toLocaleString()} piece${rosterPlayerCount === 1 ? "" : "s"} on the team list below.`
                : teamOrderStarted
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
              {teamOrderStarted ? "Jump to team list" : "Add a team list"}
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

        {/* Decoration method + pricing input for this side (CodSphere UAT
            V2, "Decoration Method, Location & Pricing Inputs"). Appears
            once artwork exists on the side — location is already the side
            the customer is looking at, so this is "method, then the
            pricing input that method needs," picked independently per
            side rather than once for the whole design. */}
        {artworks.length > 0 && (
          <div className="mt-sp-3 pt-sp-3 border-t border-border">
            <span className="block text-[11px] font-bold tracking-[0.1em] uppercase text-text-tertiary mb-2">
              Decoration — {DESIGN_SIDE_LABELS[activeSide]}
            </span>
            <select
              value={activeDecoration.methodKey}
              onChange={(e) => {
                const nextMethod = quoteMethods.find((m) => m.key === e.target.value);
                updateActiveSideDecoration({
                  methodKey: e.target.value,
                  optionKey: defaultOptionKey(nextMethod),
                });
              }}
              className="w-full border border-border rounded-md bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors mb-2"
            >
              {quoteMethods.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            {activeDecorationFields.colours && (
              <select
                value={activeDecoration.colours ?? colourOptions(activeDecorationMethod)[0] ?? 1}
                onChange={(e) =>
                  updateActiveSideDecoration({ colours: Number(e.target.value) })
                }
                className="w-full border border-border rounded-md bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              >
                {colourOptions(activeDecorationMethod).map((c) => (
                  <option key={c} value={c}>
                    {c} {c === 1 ? "Colour" : "Colours"}
                  </option>
                ))}
              </select>
            )}

            {activeDecorationFields.stitches && (
              <>
                <span className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-tertiary mb-1">
                  Size
                  <button
                    type="button"
                    aria-label="Size Guide"
                    aria-expanded={showDecorationSizeGuide}
                    onClick={() => setShowDecorationSizeGuide((v) => !v)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] font-bold normal-case"
                  >
                    i
                  </button>
                  {showDecorationSizeGuide && (
                    <div
                      role="dialog"
                      aria-label="Decoration size guide"
                      className="absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-border bg-bg p-sp-3 shadow-lg normal-case"
                    >
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide">Size Guide</p>
                      <ul className="space-y-1 text-sm">
                        <li>Small: up to 4&quot;</li>
                        <li>Medium: over 4&quot; to 8&quot;</li>
                        <li>Large: over 8&quot; to 12&quot;</li>
                        <li>Oversized: over 12&quot;</li>
                      </ul>
                    </div>
                  )}
                </span>
                <select
                  value={activeDecoration.stitchPreset ?? "medium"}
                  onChange={(e) =>
                    updateActiveSideDecoration({ stitchPreset: e.target.value })
                  }
                  className="w-full border border-border rounded-md bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                >
                  {STITCH_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {STITCH_LABELS[preset.id]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] leading-snug text-text-tertiary">
                  {STITCH_PRESET_DISCLAIMER}
                </p>
              </>
            )}

            {activeDecorationFields.option &&
              activeDecorationMethod?.rateModel.kind === "matrixByOption" && (
              <select
                value={activeDecoration.optionKey || defaultOptionKey(activeDecorationMethod)}
                onChange={(e) => updateActiveSideDecoration({ optionKey: e.target.value })}
                className="w-full border border-border rounded-md bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              >
                {activeDecorationMethod.rateModel.options.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
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

      {/* Canvas — white/light, matching the Coastal Reign benchmark. Used to
          be a dark near-black panel (bg-text-primary + bg-[#141414]); every
          white/opacity utility below is inverted to match, not just the
          background, so contrast stays correct throughout. */}
      <div className="min-w-0 w-full bg-bg border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="px-sp-4 py-sp-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <b className="font-display text-[15px] text-text-primary">2D Design Canvas</b>
            <span className="block text-[11px] text-text-tertiary mt-0.5">
              {DESIGN_SIDE_LABELS[activeSide].toUpperCase()} · PRINT METHOD · {selectedPrintLabel}
            </span>
            {rosterMarksElsewhere.map((item) => (
              <button
                key={item.target}
                type="button"
                onClick={() => setActiveSide(item.side)}
                className="block mt-0.5 text-[11px] font-semibold text-accent hover:underline"
              >
                {item.label} prints on {DESIGN_SIDE_LABELS[item.side]} — switch to see it
              </button>
            ))}
          </div>
          {activeSide === "front" ? (
            <StudioChestAlign
              tone="panel"
              compact
              value={frontAlign}
              onChange={applyAlign}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1" aria-label="Zoom">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={zoomAt <= 0}
                onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomAt - 1)]!)}
                className="h-8 w-8 rounded-sm border border-border text-text-secondary font-bold transition-colors hover:border-text-tertiary disabled:opacity-35"
              >
                −
              </button>
              <span className="min-w-12 text-center text-[11px] font-bold text-text-secondary">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={zoomAt >= ZOOM_STEPS.length - 1}
                onClick={() =>
                  setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomAt + 1)]!)
                }
                className="h-8 w-8 rounded-sm border border-border text-text-secondary font-bold transition-colors hover:border-text-tertiary disabled:opacity-35"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start min-w-0">
        <div className="p-sp-3 min-h-[280px] sm:min-h-[360px] lg:min-h-[520px] overflow-x-auto flex-1 min-w-0">
          <div className="min-w-0 w-full max-w-full bg-fill-subtle-15 rounded-md flex flex-col-reverse sm:flex-row items-stretch justify-center gap-3 p-sp-3">
            <div className="min-w-0 flex-1 flex flex-col items-center justify-center">
            <div
              className="relative w-full max-w-[min(820px,calc(100dvh-12rem))] aspect-square"
              onClick={(e) => {
                // Clicking empty canvas area deselects the active layer.
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
            >
              {currentPhoto ? (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <GarmentBackdropImage
                    url={currentPhoto}
                    fallbackUrl={studioBackdropFallbackUrl(
                      backdrop,
                      garmentPhotos,
                    )}
                    frame={framedBackdrop.frame}
                    image={framedBackdrop.image}
                    tintHex={sleeveTintHex}
                  />
                </div>
              ) : null}
              {isLoadingGarment && !currentPhoto && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-2/3 h-2/3 rounded-md bg-fill-subtle-15 animate-pulse" />
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
                rosterPreview={rosterPreviewMarks}
                selectedRosterTarget={selectedRosterTarget}
                onSelectRosterMark={setSelectedRosterTarget}
                onRosterPreviewDragEnd={handleRosterPreviewDragEnd}
                onRosterPreviewResizeEnd={handleRosterPreviewResizeEnd}
              />
              {/* CSS overlay so the guide never lands in the Konva proof. */}
              {draggingOnFront ? (
                <>
                  {/* Chest marks only — do not draw the leftover full-plate box
                      that sat flush to the top of the printable area. */}
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
                      />
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
                    />
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
              />
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
            {/* Zone + inch size sits under the whole mockup — not a chip on the plate. */}
            <p
              data-studio="print-location"
              className="m-0 mt-2 w-full max-w-[min(820px,calc(100dvh-12rem))] text-center text-[12px] font-semibold tracking-[0.02em] text-text-secondary"
            >
              {formatZoneInchLabel(liveZone ?? placementBySide[activeSide])}
            </p>
            {sleeveView && isStudioSideRepresentation(backdrop) ? (
              <p
                data-studio="sleeve-representation"
                className="m-0 mt-1 w-full max-w-[min(820px,calc(100dvh-12rem))] text-center text-[11px] font-medium tracking-[0.01em] text-text-tertiary"
              >
                This side view is for representation only.
              </p>
            ) : null}
            </div>
            <div className="flex sm:flex-col gap-2 shrink-0 sm:w-[92px]">
              <div className="flex sm:flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={undoStudio}
                  disabled={!canUndo}
                  className="h-8 flex-1 sm:w-full rounded-sm border border-border text-[11px] font-bold text-text-secondary transition-colors disabled:opacity-35 hover:border-text-tertiary"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redoStudio}
                  disabled={!canRedo}
                  className="h-8 flex-1 sm:w-full rounded-sm border border-border text-[11px] font-bold text-text-secondary transition-colors disabled:opacity-35 hover:border-text-tertiary"
                >
                  Redo
                </button>
              </div>
              {availableViews.map((side) => {
                const selected = activeSide === side;
                const hasArtwork = sideLayerCount(side) > 0;
                const thumbBackdrop = sideBackdrops[side];
                const thumbFrame = framedBackdropStyles(thumbBackdrop);
                return (
                  <button
                    key={side}
                    type="button"
                    // Always just switches the view. This used to move
                    // whatever artwork was selected to the clicked side
                    // instead — so uploading art on Front (which leaves it
                    // selected), then clicking through Back/L.Sleeve/
                    // R.Sleeve to add more, silently relocated that same
                    // one piece of artwork each time instead of adding new
                    // artwork per side, collapsing everything onto
                    // whichever thumbnail was clicked last. Moving artwork
                    // between sides is now its own explicit control in the
                    // "Edit artwork" panel, not a side-effect of navigating.
                    onClick={() => {
                      setActiveSide(side);
                      setExportError(null);
                    }}
                    aria-pressed={selected}
                    aria-label={
                      `View ${DESIGN_SIDE_LABELS[side]}` +
                      (hasArtwork ? " — artwork added" : " — no artwork yet")
                    }
                    title={`View ${DESIGN_SIDE_LABELS[side]}`}
                    className={cn(
                      "flex-1 sm:flex-none rounded-md border overflow-hidden bg-bg-raised text-left transition-colors",
                      selected
                        ? "border-accent ring-1 ring-accent"
                        : hasArtwork
                          ? "border-emerald-300"
                          : "border-border hover:border-text-tertiary",
                    )}
                  >
                    <span className="block aspect-square relative bg-fill-subtle-15">
                      {thumbBackdrop.url ? (
                        <span className="absolute inset-0 overflow-hidden">
                          <GarmentBackdropImage
                            url={studioCanvasImageUrl(thumbBackdrop)}
                            fallbackUrl={studioBackdropFallbackUrl(
                              thumbBackdrop,
                              garmentPhotos,
                            )}
                            frame={thumbFrame.frame}
                            image={thumbFrame.image}
                            tintHex={
                              thumbBackdrop.source === "side-view"
                                ? studioVisiblePlateTint(sleeveFillHex)
                                : undefined
                            }
                          />
                        </span>
                      ) : (
                        <span className="absolute inset-0 bg-fill-subtle-15" />
                      )}
                      {/* A clear, unmistakable "artwork lives here" signal —
                          not just a number, which a shopper skimming
                          thumbnails could easily read as a price or size
                          instead of a count (CodSphere UAT: "no clear
                          indication that artwork has been successfully
                          assigned/saved to that location"). */}
                      {hasArtwork && (
                        <span
                          aria-hidden
                          className="absolute top-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none shadow-sm"
                        >
                          ✓
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "block px-1.5 py-1 text-[10px] font-bold tracking-[0.04em] text-center",
                        selected ? "bg-accent text-white" : "text-text-secondary",
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
          <div className="border-t border-border lg:border-t-0 lg:border-l lg:w-[min(260px,36%)] lg:shrink-0 lg:max-h-[min(36rem,calc(100dvh-8rem))] lg:overflow-y-auto">
            <StudioElementEditor
              kind={selectedText ? "text" : "artwork"}
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
              onSliderCommit={endSliderHistory}
              moveTo={{
                options: availableViews
                  .filter((side) => side !== activeSide)
                  .map((side) => ({ id: side, label: DESIGN_SIDE_LABELS[side] })),
                onMove: (side) => moveSelectedToSide(side as DesignSide),
              }}
            />
          </div>
        )}
        </div>
      </div>

      {studioTab === "team" && (
        <div
          id="studio-team-order"
          className="md:col-start-3 bg-bg-raised border border-border rounded-lg p-sp-4 scroll-mt-24"
        >
          <StudioTeamOrderPanel
            roster={roster}
            onRosterChange={setRosterRows}
            rosterError={rosterError}
            sizes={studioRosterSizeOptions(productDetail?.variants ?? [])}
            decor={rosterDecor}
            namesNumbersFeeMinor={
              pricingConfig?.settings?.namesNumbersFeePerGarmentMinor ?? 0
            }
            onDecorChange={(target, patch) => {
              setDesign((prev) => ({
                ...prev,
                rosterDecor: patchRosterDecor(
                  prev.rosterDecor ?? defaultRosterDecor(),
                  target,
                  patch,
                ),
              }));
              // Moving a name or number to another location silently changed
              // a garment view the customer was not looking at, so the
              // control appeared to do nothing. Follow the change to the side
              // it lands on, where the placeholder is actually visible.
              if (patch.location) {
                const side = rosterPreviewSideFor(patch.location);
                if (side && side !== activeSide) setActiveSide(side);
              }
            }}
          />
        </div>
      )}

      {/* Saving, proof download and ordering belong to the main workspace,
          below the canvas they act on — not in a duplicate preview panel. */}
      <div className="md:col-start-3 bg-bg-raised border border-border rounded-lg p-sp-4">
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
            onClick={downloadMockup}
            disabled={!hasAnyDecoration || isLoadingGarment || Boolean(exportingMockup)}
          >
            {exportingMockup
              ? exportingMockup
              : !hasAnyDecoration
                ? "Add artwork to the design first"
                : "Download Mockup"}
          </Button>
          {exportError && (
            <p className="m-0 text-sm text-danger" role="alert">
              {exportError}
            </p>
          )}
          <p className="text-[12px] text-text-tertiary text-center -mt-1">
            Downloads every decorated view — front, back and sleeves — as one mockup.
          </p>

          {productDetail && selectedColorwayReady && !isStaff && (
            <div className="mt-sp-3 pt-sp-3 border-t border-border">
              {/* Size, quantity, quantity presets, print method and the
                  decoration pricing inputs used to live here. They are
                  ordering decisions, not design ones, so they now belong to
                  the Input Quantity step — the studio is only about what the
                  garment looks like. (CodSphere UAT: "Design Studio should be
                  focused exclusively on creating the garment design.") */}
              {cartError && (
                <p className="text-sm text-danger mt-2 mb-0" role="alert">
                  {cartError}
                </p>
              )}

              {/* Step 1's real exit. Sizes and quantities now belong to the
                  Input Quantity step, so the studio's job ends at "the design
                  is finished". Gated on uploads finishing because a blob: URL
                  does not survive the navigation — the artwork has to be
                  durable before the design leaves this page. */}
              {!isStaff && (
                <>
                  <Button
                    type="button"
                    className="w-full"
                    variant="primary"
                    disabled={
                      pendingUploads > 0 ||
                      !selectedColorwayReady ||
                      decoratedSides.length === 0
                    }
                    onClick={continueToQuantity}
                  >
                    {continuing
                      ? "Preparing your design…"
                      : pendingUploads > 0
                        ? "Uploading artwork…"
                        : decoratedSides.length === 0
                          ? "Add artwork or names to continue"
                          : "Continue to Quantity"}
                  </Button>
                  <p className="text-[12px] text-text-tertiary text-center mt-1.5 mb-sp-3">
                    Choose colours, sizes and quantities on the next step.
                  </p>
                </>
              )}

              {/* Add to Cart lived here. Ordering now happens on the Input
                  Quantity step — including named team orders, which arrive
                  there as one row per person — so the studio ends at
                  "Continue to Quantity" and asks no ordering question at
                  all. (CodSphere UAT: "rather than asking the customer to
                  select quantities/add pieces to cart directly from the
                  Design Studio.") */}
             </div>
          )}
        </div>
      </div>
      {showSizeChart && sizeChart && (
        <GarmentSizeChartModal
          chart={sizeChart}
          productName={selectedArticleLabel}
          onClose={() => setShowSizeChart(false)}
        />
      )}
    </div>
  );
}

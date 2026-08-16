"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  DESIGN_CANVAS_SIZE,
  DESIGN_PLACEMENT_ZONES,
  DESIGN_SIDE_LABELS,
  DesignSides,
  emptyDesignDocument,
  ephemeralArtworkSides,
  normalizeDesignDocument,
  type DesignDocument,
  type DesignSide,
  type PlacedArtwork,
} from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { RecolorGarment } from "@/components/pdp/RecolorGarment";
import { useCartStore } from "@/lib/store/cart";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { priceGarmentFromCurve, type GarmentPriceCurve } from "@gwg/pricing";
import { RosterEditor, type RosterRow } from "@/components/shared/RosterEditor";

export type DesignGarmentOption = {
  id: string;
  label: string;
  colorName: string;
  imageUrl: string | null;
  isDark: boolean;
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
): number {
  if (!variant) return 0;
  if (!variant.priceCurve || !variant.customerPriceMinor) {
    return variant.retailMinor;
  }
  return priceGarmentFromCurve(variant.priceCurve, {
    unitCostMinor: variant.customerPriceMinor,
    quantity: Math.max(1, quantity),
    mapPriceMinor: variant.mapPriceMinor ?? null,
  }).sellPerPieceMinor;
}

type ProductDetail = {
  product: {
    id: string;
    colorName: string;
    colorFrontImageUrl: string | null;
    colorSideImageUrl: string | null;
    colorBackImageUrl: string | null;
  };
  style: {
    id: string;
    brandName: string;
    styleName: string;
    styleImageUrl: string | null;
  };
  variants: ProductDetailVariant[];
};

const DESIGN_QTY_OPTIONS = [24, 48, 96, 250, 500];

// react-konva touches the DOM directly — must be client-only, no SSR. The
// whole canvas (Stage + Layer + artwork layers) is lazy-loaded as ONE unit,
// not per-primitive: react-konva's custom reconciler calls flushSync
// internally on stage updates, and if Stage/Layer are themselves
// React.lazy-wrapped, that synchronous flush can fire before the lazy
// import resolves, outside any Suspense boundary — see DesignCanvas.tsx.
const DesignCanvas = dynamic(() => import("@/components/design/DesignCanvas"), {
  ssr: false,
});

const GARMENT_SILHOUETTE_COLOR = "#3a2216";

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
}: {
  garments?: DesignGarmentOption[];
  signedIn?: boolean;
  initialDesign?: SavedDesignProject | null;
  /** Set when arriving via "Preview my design on this" from a product card/PDP. */
  garmentIdOverride?: string | null;
  /** Staff mode drops the buying controls: nobody checks out from the admin. */
  mode?: "customer" | "staff";
  endpoints?: DesignStudioEndpoints;
}) {
  const isStaff = mode === "staff";
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
  const [approved, setApproved] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    initialDesign?.garmentProductId ?? garments[0]?.id ?? null,
  );
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [designQty, setDesignQty] = useState(48);
  const [addedToCart, setAddedToCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [groupOrder, setGroupOrder] = useState(false);
  const [roster, setRoster] = useState<RosterRow[]>([{ size: "", name: "", number: "" }]);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [savedDesignId, setSavedDesignId] = useState<string | null>(
    initialDesign?.id ?? null,
  );
  const [designName, setDesignName] = useState(initialDesign?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const artworks = artworksBySide[activeSide];
  const selectedId = selectedBySide[activeSide];

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
    const inStock = variants.find((v) => v.qty > 0 && v.active !== false);
    setSelectedVariantId((inStock ?? variants[0])?.id ?? null);
  }, [productDetail]);

  // Persistent design + 1-click apply: when arriving without an explicit
  // saved design to load, pick up whatever's already in progress (or was
  // last saved) so it follows the customer across the catalog. A
  // `garmentIdOverride` from a "Preview my design on this" click always
  // wins for the garment, while the artwork itself carries over.
  useEffect(() => {
    // Staff are editing one specific customer's design; the browser-local
    // "design in progress" belongs to whoever last used this machine and
    // must never bleed into it.
    if (initialDesign || isStaff) return;
    const stored = useActiveDesignStore.getState();
    if (hasActiveArtwork(stored.design)) {
      setDesign(normalizeDesignDocument(stored.design));
      if (stored.name) setDesignName(stored.name);
      if (stored.savedDesignId) setSavedDesignId(stored.savedDesignId);
      if (!garmentIdOverride && stored.garmentProductId) {
        setSelectedGarmentId(stored.garmentProductId);
      }
    }
    if (garmentIdOverride) {
      setSelectedGarmentId(garmentIdOverride);
    }
    // Runs once on mount only — this hydrates from persisted state, it
    // isn't meant to re-sync on every dependency change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (garments.some((g) => g.id === selectedGarmentId)) {
      setExtraGarment(null);
      return;
    }
    setExtraGarment({
      id: String(productDetail.product.id),
      label: `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim(),
      colorName: productDetail.product.colorName,
      imageUrl: productDetail.product.colorFrontImageUrl || productDetail.style.styleImageUrl,
      isDark: false,
    });
  }, [productDetail, selectedGarmentId, garments]);
  const garmentOptions = extraGarment ? [extraGarment, ...garments] : garments;

  const selectedVariant = productDetail?.variants.find(
    (v) => v.id === selectedVariantId,
  );
  // Falls back to the style's generic photo when this colorway has no
  // front/back photo of its own — otherwise the canvas showed a blank
  // silhouette even though a usable photo existed (same gap as the
  // catalog grid had before its listProducts fix).
  // Vendors supply at most one side photo and never say which sleeve it is.
  // Rather than hide the sleeves behind that gap, both sleeve views reuse it
  // and the right one is mirrored, so a customer can always place a sleeve
  // print and the mockup at least faces the right way.
  const photoBySide: Record<DesignSide, string | null> = {
    front:
      productDetail?.product.colorFrontImageUrl || productDetail?.style.styleImageUrl || null,
    back:
      productDetail?.product.colorBackImageUrl || productDetail?.style.styleImageUrl || null,
    left: productDetail?.product.colorSideImageUrl || null,
    right: productDetail?.product.colorSideImageUrl || null,
  };
  const currentPhoto = productDetail ? photoBySide[activeSide] : null;
  const mirrorPhoto = activeSide === "right";
  const isLoadingGarment = Boolean(selectedGarmentId) && !productDetail;

  // All four views are always offered. A sleeve print is a real thing a
  // customer orders whether or not the vendor photographed that angle, and
  // the artwork is stored per view either way.
  const availableViews = DesignSides;

  function setSelectedId(id: string | null) {
    setSelectedBySide((prev) => ({ ...prev, [activeSide]: id }));
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

  function setActiveArtworks(
    update: (artworks: PlacedArtwork[]) => PlacedArtwork[]
  ) {
    updateArtworks(activeSide, update);
    setExportedUrl(null);
  }

  function setPlacement(side: DesignSide, zone: string) {
    setDesign((prev) => ({
      ...prev,
      placementBySide: { ...prev.placementBySide, [side]: zone },
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
   */
  async function addArtworkFromBlob(
    blob: Blob,
    filename: string,
    scale = 0.4,
  ): Promise<string | null> {
    const objectUrl = URL.createObjectURL(blob);
    const id = crypto.randomUUID();
    const side = activeSide;

    const newArtwork: PlacedArtwork = {
      id,
      src: objectUrl,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      scaleX: scale,
      scaleY: scale,
      rotation: 0,
    };

    setActiveArtworks((prev) => [...prev, newArtwork]);
    setSelectedId(id);

    if (!signedIn) {
      // Nothing to upload to — anonymous visitors get a working preview and
      // the sign-in nudge next to the save box tells them why it stops there.
      return null;
    }

    const hostedUrl = await uploadArtwork(side, id, blob, filename);
    // Only safe to release once the hosted copy has been loaded, which
    // uploadArtwork has already confirmed; releasing earlier would blank the
    // layer for as long as the swap took.
    if (hostedUrl) URL.revokeObjectURL(objectUrl);
    return hostedUrl;
  }

  function removeSelected() {
    if (!selectedId) return;
    setActiveArtworks((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }

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
      await addArtworkFromBlob(blob, "ai-concept.png", 0.45);
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
    try {
      return stageRef.current?.toDataURL({ pixelRatio: 2 }) ?? null;
    } catch {
      return null;
    }
  }

  function handleApprove() {
    // Export the selected side locally. Persistence is intentionally deferred.
    const dataUrl = exportStageDataUrl();
    if (dataUrl) setExportedUrl(dataUrl);
    setApproved(true);
    setTimeout(() => setApproved(false), 2000);
  }

  async function addDesignToCart() {
    if (!productDetail) return;

    // Validate before uploading: an upload spent on a roster that is about to
    // be rejected is a round trip nobody asked for.
    if (groupOrder) {
      if (roster.length === 0) {
        setRosterError("Add at least one person.");
        return;
      }
      if (roster.some((r) => !r.name.trim())) {
        setRosterError("Every row needs a name.");
        return;
      }
      setRosterError(null);
    } else if (!selectedVariant) {
      return;
    }

    // The proof has to end up somewhere staff can open. Carrying the canvas as
    // a data: URL looked like it worked and then died on the way to checkout,
    // which is how orders reached production with no artwork attached.
    setCartError(null);
    setAddingToCart(true);
    let artworkProofUrl: string | undefined;
    try {
      artworkProofUrl = (await uploadProofImage()) ?? undefined;
    } finally {
      setAddingToCart(false);
    }
    if (!artworkProofUrl) {
      setCartError(
        signedIn
          ? "Your artwork could not be attached, so the order would reach us blank. Try again."
          : "Sign in first — otherwise your artwork does not travel with the order.",
      );
      return;
    }

    // Every decorated view earns a line on the order. The old label only
    // ever mentioned two of them, so a sleeve print reached production
    // undescribed even when the customer had placed one.
    const decorated = DesignSides.filter(
      (side) => artworksBySide[side].length > 0,
    );
    const printLabel = (decorated.length > 0 ? decorated : [activeSide])
      .map(
        (side) =>
          `${placementBySide[side]} (${DESIGN_SIDE_LABELS[side].toLowerCase()})`,
      )
      .join(" + ");
    const productName =
      `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim();

    if (groupOrder) {
      const priceVariant =
        productDetail.variants.find((v) => v.sizeName === roster[0]!.size) ??
        selectedVariant;
      if (!priceVariant) return;
      addItem({
        id: productDetail.product.id,
        productId: productDetail.product.id,
        styleId: productDetail.style.id,
        variantId: priceVariant.id,
        name: productName,
        meta: `Custom design · Team order · ${roster.length} pieces, mixed sizes · ${printLabel}`,
        color: productDetail.product.colorName,
        qty: roster.length,
        unit: unitPriceMinor(priceVariant, roster.length) / 100,
        image: currentPhoto || "",
        artworkProofUrl,
        designProjectId: savedDesignId ?? undefined,
        roster: roster.map((r) => ({
          size: r.size,
          name: r.name.trim(),
          number: r.number.trim() || undefined,
        })),
      });
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
      return;
    }

    if (!selectedVariant) return;
    addItem({
      id: productDetail.product.id,
      productId: productDetail.product.id,
      styleId: productDetail.style.id,
      variantId: selectedVariant.id,
      name: productName,
      meta: `Custom design · Size ${selectedVariant.sizeName} · ${printLabel}`,
      color: productDetail.product.colorName,
      qty: designQty,
      unit: unitPriceMinor(selectedVariant, designQty) / 100,
      image: currentPhoto || "",
      artworkProofUrl,
      designProjectId: savedDesignId ?? undefined,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
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

  async function handleSaveDesign() {
    if (!designName.trim()) {
      setSaveError("Give this design a name first.");
      return;
    }
    if (pendingUploads > 0) {
      setSaveError("Hold on — artwork is still uploading.");
      return;
    }
    // The guard that makes a save honest. Without it the design persists
    // object URLs, reports success, and reloads blank.
    const unsafeSides = ephemeralArtworkSides(design);
    if (unsafeSides.length > 0) {
      setSaveError(
        `Artwork on the ${unsafeSides
          .map((side) => DESIGN_SIDE_LABELS[side].toLowerCase())
          .join(" and ")} has not been uploaded yet, so it would not survive a reload. ${
          signedIn
            ? "Remove and re-add it, then save again."
            : "Sign in and re-add it to keep it."
        }`,
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const proofImageUrl = await uploadProofImage();
      const payload = {
        name: designName.trim(),
        garmentProductId: selectedGarmentId,
        design,
        proofImageUrl,
      };
      const target = savedDesignId ? `${updateUrl}/${savedDesignId}` : createUrl;
      if (!target) throw new Error("This design cannot be saved from here.");
      const response = await fetch(target, {
        method: savedDesignId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || "Could not save the design.");
      }
      if (!savedDesignId && body?.design?.id) {
        setSavedDesignId(body.design.id);
      }
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1.35fr_1fr] gap-sp-3 items-stretch">
      {/* Details / assets column — Figma left rail */}
      <aside className="bg-bg-raised border border-border rounded-lg overflow-hidden flex flex-col lg:flex-row min-h-[520px]">
        <div className="flex lg:flex-col border-b lg:border-b-0 lg:border-r border-border bg-bg shrink-0">
          {["Product", "Image", "AI Art", "Text", "Names", "Notes"].map(
            (tab, index) => (
              <span
                key={tab}
                className={cn(
                  "px-3 py-3 text-[11px] font-bold text-center lg:w-[72px]",
                  index === 0
                    ? "bg-accent-tint text-accent border-b-2 lg:border-b-0 lg:border-l-2 border-accent"
                    : "text-text-tertiary",
                )}
              >
                {tab}
              </span>
            ),
          )}
        </div>

        <div className="p-sp-4 flex flex-col gap-2.5 flex-1">
        {garmentOptions.length > 0 && (
          <div className="mb-sp-2">
            <h4 className="font-display text-[16px] mb-1">
              {garmentOptions.find((g) => g.id === selectedGarmentId)?.label ||
                "Garment"}
            </h4>
            <p className="text-xs text-text-secondary m-0 mb-2">
              Colour:{" "}
              {garmentOptions.find((g) => g.id === selectedGarmentId)?.colorName ||
                "—"}
            </p>
            <select
              value={selectedGarmentId ?? ""}
              onChange={(e) => setSelectedGarmentId(e.target.value || null)}
              className="w-full min-h-11 border border-border rounded-sm bg-bg-raised px-3 py-2.5 text-base font-body font-semibold text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {garmentOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label} · {g.colorName}
                </option>
              ))}
            </select>
          </div>
        )}

        <ul className="m-0 mb-sp-2 pl-4 text-sm text-text-secondary space-y-1">
          <li>Made from 100% combed ring-spun cotton</li>
          <li>Weighs 6.5oz, reinforced seams</li>
          <li>Classic fit, true to size</li>
        </ul>

        <h4 className="font-display text-[16px] mb-sp-2">Assets</h4>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={handleFileSelected}
        />
        <input
          ref={artInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={handleFileSelected}
        />

        <button
          onClick={() => logoInputRef.current?.click()}
          className="border border-dashed border-border rounded-md py-3 font-bold text-sm hover:border-accent hover:text-accent hover:bg-accent-tint transition-colors"
        >
          Upload Logo
        </button>
        <button
          onClick={() => artInputRef.current?.click()}
          className="border border-dashed border-border rounded-md py-3 font-bold text-sm hover:border-accent hover:text-accent hover:bg-accent-tint transition-colors"
        >
          Upload Artwork
        </button>

        <button
          onClick={() => setShowAiPrompt((open) => !open)}
          className="bg-accent border border-accent text-white rounded-md py-3 font-bold text-sm hover:bg-accent-hover transition-colors"
        >
          AI Concept
        </button>

        {showAiPrompt && (
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

        {artworks.length > 0 && (
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
      <div className="bg-text-primary text-white rounded-lg overflow-hidden flex flex-col">
        <div className="px-sp-4 py-sp-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <b className="font-display text-[15px]">2D Design Canvas</b>
            <span className="block text-[11px] text-white/55 mt-0.5">
              {DESIGN_SIDE_LABELS[activeSide].toUpperCase()} · PRINT METHOD · Print
            </span>
          </div>
          <div className="flex gap-2">
            <span className="rounded-sm border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white/70">
              Undo
            </span>
            <span className="rounded-sm border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white/70">
              Redo
            </span>
            <span className="rounded-sm border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white/70">
              Zoom
            </span>
          </div>
        </div>

        <div className="px-sp-4 py-sp-3 border-b border-white/10 flex flex-wrap items-end justify-between gap-sp-3">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45 mb-1.5">
              Which side are you designing?
            </span>
            <div className="flex gap-2">
              {availableViews.map((side) => (
                <button
                  key={side}
                  onClick={() => {
                    setActiveSide(side);
                    setExportedUrl(null);
                  }}
                  aria-pressed={activeSide === side}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-bold transition-colors",
                    activeSide === side
                      ? "bg-accent border-accent text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                  )}
                >
                  {DESIGN_SIDE_LABELS[side]}
                  {artworksBySide[side].length > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-bold",
                        activeSide === side ? "bg-white/25" : "bg-white/15"
                      )}
                    >
                      {artworksBySide[side].length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45 mb-1.5">
              Where the print goes
            </span>
            <div className="relative">
              <select
                value={placementBySide[activeSide]}
                onChange={(e) => setPlacement(activeSide, e.target.value)}
                className="bg-accent text-white text-base font-bold pl-3.5 pr-8 py-2.5 min-h-11 rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                {DESIGN_PLACEMENT_ZONES[activeSide].map((zone) => (
                  <option key={zone} value={zone} className="text-text-primary">
                    {zone}
                  </option>
                ))}
              </select>
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 8"
                fill="none"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              >
                <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </label>
        </div>

        <div className="p-sp-3 min-h-[280px] sm:min-h-[340px] overflow-x-auto">
          <div className="bg-[#141414] rounded-md flex items-center justify-center p-sp-3 min-w-[min(100%,340px)]">
            <div
              className="relative"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              onClick={(e) => {
                // Clicking empty canvas area deselects the active layer.
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
            >
              {/* Garment layer — uses the real synced product photo when a
                  live catalog garment is selected; otherwise falls back to
                  the flat recolored silhouette. A distinct pulse state while
                  the photo is in flight keeps that fallback from reading as
                  a stuck/broken product. */}
              {isLoadingGarment ? (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-2/3 h-2/3 rounded-md bg-white/5 animate-pulse" />
                </div>
              ) : currentPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentPhoto}
                  alt=""
                  className={cn(
                    "absolute inset-0 w-full h-full object-contain",
                    mirrorPhoto && "-scale-x-100",
                  )}
                />
              ) : (
                <RecolorGarment
                  maskSrc="/images/t-shirt.png"
                  color={GARMENT_SILHOUETTE_COLOR}
                  className={cn(
                    "absolute inset-0",
                    (activeSide === "back" || mirrorPhoto) && "-scale-x-100",
                  )}
                />
              )}

              {/* Artwork layer — real, interactive, exports real pixels */}
              <DesignCanvas
                activeSide={activeSide}
                artworks={artworks}
                selectedId={selectedId}
                canvasSize={CANVAS_SIZE}
                stageRef={stageRef}
                onSelect={setSelectedId}
                onChange={(next) =>
                  setActiveArtworks((prev) =>
                    prev.map((p) => (p.id === next.id ? next : p))
                  )
                }
              />
            </div>
          </div>
        </div>

        <p className="px-sp-3 pb-sp-3 text-[12px] text-white/50">
          Drag to move, use the corner handles to scale, and the top handle to
          rotate a selected layer. Front and back layers are saved separately.
        </p>
      </div>

      {/* Live mockup */}
      <div className="bg-bg-raised border border-border rounded-lg p-sp-4 flex flex-col">
        <div className="flex justify-between items-center mb-sp-3">
          <b className="font-display text-[15px]">Preview Mockup</b>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            2D
          </span>
        </div>

        <div className="flex-1 min-h-[280px] rounded-md border border-border bg-[radial-gradient(80%_90%_at_50%_15%,#fff,#E8E5DC_70%,#D6D2C7_100%)] flex items-center justify-center p-sp-3 mb-sp-3 overflow-hidden">
          <div className="relative w-3/4 max-w-[280px] aspect-square">
            {isLoadingGarment ? (
              <div className="absolute inset-0 grid place-items-center">
                <div className="w-2/3 h-2/3 rounded-md bg-black/5 animate-pulse" />
              </div>
            ) : currentPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPhoto}
                alt=""
                className={cn(
                  "absolute inset-0 w-full h-full object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]",
                  mirrorPhoto && "-scale-x-100",
                )}
              />
            ) : (
              <RecolorGarment
                maskSrc="/images/t-shirt.png"
                color={GARMENT_SILHOUETTE_COLOR}
                className={cn(
                  "absolute inset-0 drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]",
                  (activeSide === "back" || mirrorPhoto) && "-scale-x-100"
                )}
              />
            )}
            {exportedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={exportedUrl}
                alt={`${DESIGN_SIDE_LABELS[activeSide]} artwork preview`}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            {!currentPhoto && (
              <span className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-text-tertiary">
                Representative {DESIGN_SIDE_LABELS[activeSide].toLowerCase()} silhouette
              </span>
            )}
          </div>
        </div>

        <div className="mb-sp-3 rounded-md overflow-hidden border border-border bg-text-primary">
          <video
            src="/images/design-studio-3d-mockup.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full aspect-video object-cover"
          />
          <p className="m-0 px-3 py-2 text-[11px] text-white/70">
            3D reference footage — not artwork-accurate. Use the 2D canvas above for placement.
          </p>
        </div>

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
              <a href="/account?next=/design" className="text-accent font-bold">
                Sign in
              </a>{" "}
              to save this design to your profile and reuse it on other products.
              Artwork is only stored once you do.
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleApprove}
            disabled={artworks.length === 0}
          >
            {approved
              ? "Artwork export ready ✓"
              : artworks.length === 0
                ? `Add artwork to the ${DESIGN_SIDE_LABELS[activeSide].toLowerCase()} first`
                : `Export ${DESIGN_SIDE_LABELS[activeSide]} Artwork`}
          </Button>
          {exportedUrl && (
            <>
              <a
                href={exportedUrl}
                download={`great-west-graphics-${activeSide}-artwork.png`}
                className="w-full rounded-md border border-border px-4 py-2.5 text-center text-sm font-bold hover:bg-fill-subtle-15 transition-colors"
              >
                Download proof
              </a>
              <p className="text-[12px] text-text-tertiary text-center -mt-1">
                Downloads the selected side&apos;s transparent artwork overlay; the
                garment silhouette is representative only.
              </p>
            </>
          )}

          {productDetail && !isStaff && (
            <div className="mt-sp-3 pt-sp-3 border-t border-border">
              <label className="flex items-center gap-2 text-xs font-bold mb-sp-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupOrder}
                  onChange={(e) => {
                    setGroupOrder(e.target.checked);
                    setRosterError(null);
                  }}
                />
                Team/group order — different sizes, names &amp; numbers
              </label>

              {groupOrder ? (
                <div className="mb-sp-3 border border-border rounded-md p-sp-3 bg-bg">
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary block mb-2">
                    Roster
                  </span>
                  <RosterEditor
                    sizes={productDetail.variants
                      .filter((v) => v.qty > 0 && v.active !== false)
                      .map((v) => ({ id: v.id, label: v.sizeName }))}
                    rows={roster}
                    onChange={setRoster}
                  />
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
                      <span className="text-xs font-bold block mb-1.5">
                        Size:{" "}
                        <span className="font-normal">
                          {selectedVariant?.sizeName ?? "Select a size"}
                        </span>
                      </span>
                      <div className="flex gap-1.5 flex-wrap mb-sp-3">
                        {productDetail.variants.map((v) => {
                          const inStock = v.qty > 0 && v.active !== false;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={!inStock}
                              onClick={() => setSelectedVariantId(v.id)}
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
                </>
              )}

              {cartError && (
                <p className="text-sm text-danger mt-2 mb-0" role="alert">
                  {cartError}
                </p>
              )}

              <Button
                className="w-full"
                variant="primary"
                disabled={
                  addingToCart ||
                  (groupOrder
                    ? roster.length === 0
                    : !selectedVariant?.active || (selectedVariant?.qty ?? 0) <= 0)
                }
                onClick={addDesignToCart}
              >
                {addingToCart
                  ? "Attaching artwork…"
                  : groupOrder
                    ? addedToCart
                      ? "Added ✓"
                      : `Add ${roster.length.toLocaleString()} Piece${roster.length === 1 ? "" : "s"} to Cart`
                    : !selectedVariant || selectedVariant.qty <= 0
                      ? "Unavailable"
                      : addedToCart
                        ? "Added ✓"
                        : `Add ${designQty.toLocaleString()} Piece${designQty === 1 ? "" : "s"} to Cart · ${moneyFromMinor(
                            unitPriceMinor(selectedVariant, designQty) * designQty,
                          )}`}
              </Button>
            </div>
          )}
        </div>
      </div>
      <p className="lg:col-span-3 text-xs text-text-tertiary">
        3D artwork preview is unavailable because no UV-mapped garment model is
        included. The reference footage above is not an artwork-accurate interactive
        preview. Sleeve views reuse the vendor&apos;s side photo where one exists and
        a representative silhouette where it does not — your artwork and its
        placement are saved per view either way.
      </p>
    </div>
  );
}
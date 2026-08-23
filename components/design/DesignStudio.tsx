"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  DESIGN_CANVAS_SIZE,
  DESIGN_PLACEMENT_ZONES,
  DESIGN_SIDE_LABELS,
  DesignSides,
  emptyDesignDocument,
  ephemeralArtworkSides,
  isDurableArtworkSrc,
  normalizeDesignDocument,
  type DesignDocument,
  type DesignSide,
  type PlacedArtwork,
} from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import {
  artworkSrcForDraft,
  dataUrlToBlob,
  filenameForArtworkBlob,
} from "@/lib/store/design-draft";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { priceGarmentFromCurve, type GarmentPriceCurve } from "@gwg/pricing";
import { RosterEditor, type RosterRow } from "@/components/shared/RosterEditor";
import {
  backdropImageStyle,
  garmentBackdropForSide,
  studioCanvasImageUrl,
} from "@/lib/commerce/garment-backdrop";
import {
  cartPlacementSuffix,
  cartPrintMetaLabel,
  decoratedDesignSides,
} from "@/lib/commerce/studio-placement";

export type DesignGarmentOption = {
  id: string;
  label: string;
  colorName: string;
  imageUrl: string | null;
  sideImageUrl?: string | null;
  backImageUrl?: string | null;
  isDark: boolean;
  slug?: string;
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
    slug?: string;
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
    initialDesign?.garmentProductId ?? garments[0]?.id ?? null,
  );
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [designQty, setDesignQty] = useState(48);
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

  const artworkInputRef = useRef<HTMLInputElement>(null);
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
      slug: productDetail.product.slug,
      label: `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim(),
      colorName: productDetail.product.colorName,
      imageUrl: productDetail.product.colorFrontImageUrl || productDetail.style.styleImageUrl,
      sideImageUrl: productDetail.product.colorSideImageUrl,
      backImageUrl: productDetail.product.colorBackImageUrl,
      isDark: false,
    });
  }, [productDetail, selectedGarmentId, garments]);
  const garmentOptions = useMemo(
    () => (extraGarment ? [extraGarment, ...garments] : garments),
    [extraGarment, garments],
  );
  const selectedGarment = garmentOptions.find((g) => g.id === selectedGarmentId);

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
  // Front/back can use the list photo while detail loads. Sleeves use a
  // vendor side shot when the catalog has one, otherwise a crop of that
  // colorway — never the full chest frame.
  const backdrop = garmentBackdropForSide(activeSide, {
    colorFrontImageUrl:
      productDetail?.product.colorFrontImageUrl ||
      selectedGarment?.imageUrl ||
      null,
    colorSideImageUrl:
      productDetail?.product.colorSideImageUrl ||
      selectedGarment?.sideImageUrl ||
      null,
    colorBackImageUrl:
      productDetail?.product.colorBackImageUrl ||
      selectedGarment?.backImageUrl ||
      null,
    styleImageUrl: productDetail?.style.styleImageUrl,
  });
  const currentPhoto = backdrop.url;
  const mirrorPhoto = backdrop.mirror;
  const isLoadingGarment = Boolean(selectedGarmentId) && !productDetail;
  const canvasGarmentImageUrl = studioCanvasImageUrl(backdrop);

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
    setExportError(null);
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
   */
  async function addArtworkFromBlob(
    blob: Blob,
    filename: string,
    scale = 0.4,
  ): Promise<string | null> {
    const id = crypto.randomUUID();
    const side = activeSide;
    // Unsigned visitors cannot upload. A `blob:` URL dies when they leave
    // to confirm an account, so the draft is stored as a data URL that
    // localStorage can bring back onto the canvas after sign-in.
    const src = signedIn
      ? URL.createObjectURL(blob)
      : await artworkSrcForDraft(blob);

    const newArtwork: PlacedArtwork = {
      id,
      src,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      scaleX: scale,
      scaleY: scale,
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
    if (!productDetail) {
      setCartError("Pick a garment first.");
      return;
    }

    const decorated = decoratedDesignSides(artworksBySide);
    if (decorated.length === 0) {
      setCartError("Place artwork on the garment first.");
      return;
    }

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
      setCartError("Select a size first.");
      return;
    }

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

      if (groupOrder) {
        const priceVariant =
          productDetail.variants.find((v) => v.sizeName === roster[0]!.size) ??
          selectedVariant;
        if (!priceVariant) {
          setCartError("Select a size for the first roster row.");
          return;
        }
        addItem({
          id: productDetail.product.id,
          productId: productDetail.product.id,
          productSlug,
          styleId: productDetail.style.id,
          variantId: priceVariant.id,
          name: productName,
          meta: `Custom design · Team order · ${roster.length} pieces, mixed sizes · ${printLabel}`,
          color: productDetail.product.colorName,
          qty: roster.length,
          unit: unitPriceMinor(priceVariant, roster.length) / 100,
          image: artworkProofUrl || currentPhoto || "",
          artworkProofUrl,
          designProjectId,
          roster: roster.map((r) => ({
            size: r.size,
            name: r.name.trim(),
            number: r.number.trim() || undefined,
          })),
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
        meta: `Custom design · Size ${selectedVariant.sizeName} · ${printLabel}`,
        color: productDetail.product.colorName,
        qty: designQty,
        unit: unitPriceMinor(selectedVariant, designQty) / 100,
        image: artworkProofUrl || currentPhoto || "",
        artworkProofUrl,
        designProjectId,
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

  const decoratedSides = decoratedDesignSides(artworksBySide);
  const placementSuffix = cartPlacementSuffix(
    decoratedSides,
    placementBySide,
    activeSide,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-sp-3 items-start">
      {/* Product and artwork controls. Every visible control is interactive. */}
      <aside className="bg-bg-raised border border-border rounded-lg overflow-hidden flex flex-col min-h-[520px]">
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
          ref={artworkInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={handleFileSelected}
        />

        <button
          onClick={() => artworkInputRef.current?.click()}
          className="border border-dashed border-border rounded-md py-3 font-bold text-sm hover:border-accent hover:text-accent hover:bg-accent-tint transition-colors"
        >
          Upload logo or artwork
        </button>
        <p className="m-0 text-[11px] leading-4 text-text-tertiary">
          PNG, JPG or SVG. You can add more than one layer.
        </p>

        <button
          onClick={() => setShowAiPrompt((open) => !open)}
          className="bg-accent border border-accent text-white rounded-md py-3 font-bold text-sm hover:bg-accent-hover transition-colors"
        >
          Generate an AI concept
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
      <div className="min-w-0 w-full bg-text-primary text-white rounded-lg overflow-hidden flex flex-col">
        <div className="px-sp-4 py-sp-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <b className="font-display text-[15px]">2D Design Canvas</b>
            <span className="block text-[11px] text-white/55 mt-0.5">
              {DESIGN_SIDE_LABELS[activeSide].toUpperCase()} · PRINT METHOD · Print
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
                    setExportError(null);
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
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-1">
              Print location
            </span>
            <div className="relative">
              <select
                value={placementBySide[activeSide]}
                onChange={(e) => setPlacement(activeSide, e.target.value)}
                aria-label="Print location"
                className="bg-transparent border border-white/15 text-white/70 text-[12px] font-semibold pl-2.5 pr-6 py-1 min-h-8 rounded-md appearance-none cursor-pointer hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {DESIGN_PLACEMENT_ZONES[activeSide].map((zone) => (
                  <option key={zone} value={zone} className="text-text-primary">
                    {zone}
                  </option>
                ))}
              </select>
              <svg
                width="8"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50"
              >
                <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </label>
        </div>

        <div className="p-sp-3 min-h-[280px] sm:min-h-[340px] overflow-x-auto">
          <div className="min-w-0 w-full max-w-full overflow-hidden bg-[#141414] rounded-md flex items-center justify-center p-sp-3">
            <div
              className="relative w-full max-w-[600px] aspect-square"
              onClick={(e) => {
                // Clicking empty canvas area deselects the active layer.
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
            >
              {currentPhoto && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element -- paint immediately; Konva still waits on the canvas URL */}
                  <img
                    src={currentPhoto}
                    alt=""
                    style={backdropImageStyle(
                      backdrop.crop,
                      Boolean(mirrorPhoto && !backdrop.crop),
                    )}
                  />
                </div>
              )}
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
                selectedId={selectedId}
                canvasSize={CANVAS_SIZE}
                garmentImageUrl={canvasGarmentImageUrl}
                mirrorGarment={mirrorPhoto}
                garmentCrop={backdrop.crop}
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
      </div>

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
              <a href="/account?next=/design" className="text-accent font-bold">
                Sign in
              </a>{" "}
              to keep this mockup on your account. The artwork stays on this
              canvas when you come back — then we upload it so staff can open
              the same file.
            </p>
          )}

          <Button
            className="w-full"
            onClick={downloadProof}
            disabled={artworks.length === 0 || isLoadingGarment}
          >
            {artworks.length === 0
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
                type="button"
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
                    ? `Add ${roster.length.toLocaleString()} Piece${roster.length === 1 ? "" : "s"} to Cart · ${placementSuffix}`
                    : !selectedVariant || selectedVariant.qty <= 0
                      ? "Unavailable"
                      : `Add ${designQty.toLocaleString()} Piece${designQty === 1 ? "" : "s"} to Cart · ${placementSuffix} · ${moneyFromMinor(
                          unitPriceMinor(selectedVariant, designQty) * designQty,
                        )}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

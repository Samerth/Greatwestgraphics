"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { RecolorGarment } from "@/components/pdp/RecolorGarment";
import type { PlacedArtwork } from "@/components/design/ArtworkLayer";
import { useCartStore } from "@/lib/store/cart";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
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
};

type ProductDetail = {
  product: {
    id: string;
    colorName: string;
    colorFrontImageUrl: string | null;
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

const GARMENT_VIEWS = {
  front: { label: "Front", color: "#3a2216" },
  back: { label: "Back", color: "#3a2216" },
} as const;

type GarmentSide = keyof typeof GARMENT_VIEWS;

// Both sleeves are visible in a standard front- or back-facing product
// photo, so a sleeve placement doesn't need its own canvas view — just an
// artist manually dragging the layer onto the sleeve area on whichever
// side is active, same as a real screen printer would mark it up.
const PLACEMENT_ZONES: Record<GarmentSide, string[]> = {
  front: ["Left Chest", "Center Chest", "Full Front", "Left Sleeve", "Right Sleeve"],
  back: ["Upper Back", "Full Back", "Left Sleeve", "Right Sleeve"],
};
type ArtworkBySide = Record<GarmentSide, PlacedArtwork[]>;

const CANVAS_SIZE = 340;

export type SavedDesignProject = {
  id: string;
  name: string;
  garmentProductId: string | null;
  artworksBySide: ArtworkBySide;
};

export function DesignStudio({
  garments = [],
  signedIn = false,
  initialDesign = null,
  garmentIdOverride = null,
}: {
  garments?: DesignGarmentOption[];
  signedIn?: boolean;
  initialDesign?: SavedDesignProject | null;
  /** Set when arriving via "Preview my design on this" from a product card/PDP. */
  garmentIdOverride?: string | null;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const [activeSide, setActiveSide] = useState<GarmentSide>("front");
  const [artworksBySide, setArtworksBySide] = useState<ArtworkBySide>(
    initialDesign?.artworksBySide ?? { front: [], back: [] },
  );
  const [selectedBySide, setSelectedBySide] = useState<
    Record<GarmentSide, string | null>
  >({ front: null, back: null });
  const [placementBySide, setPlacementBySide] = useState<
    Record<GarmentSide, string>
  >({ front: PLACEMENT_ZONES.front[0]!, back: PLACEMENT_ZONES.back[0]! });
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
    if (initialDesign) return;
    const stored = useActiveDesignStore.getState();
    if (hasActiveArtwork(stored.artworksBySide)) {
      setArtworksBySide(stored.artworksBySide);
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
    if (!hasActiveArtwork(artworksBySide)) return;
    useActiveDesignStore.getState().setDesign({
      name: designName,
      garmentProductId: selectedGarmentId,
      artworksBySide,
      savedDesignId,
    });
  }, [artworksBySide, selectedGarmentId, designName, savedDesignId]);

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
  const photoBySide: Record<GarmentSide, string | null> = {
    front:
      productDetail?.product.colorFrontImageUrl || productDetail?.style.styleImageUrl || null,
    back:
      productDetail?.product.colorBackImageUrl || productDetail?.style.styleImageUrl || null,
  };
  const currentPhoto = productDetail ? photoBySide[activeSide] : null;
  const isLoadingGarment = Boolean(selectedGarmentId) && !productDetail;

  function setSelectedId(id: string | null) {
    setSelectedBySide((prev) => ({ ...prev, [activeSide]: id }));
  }

  function setActiveArtworks(
    update: (artworks: PlacedArtwork[]) => PlacedArtwork[]
  ) {
    setArtworksBySide((prev) => ({
      ...prev,
      [activeSide]: update(prev[activeSide]),
    }));
    setExportedUrl(null);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview via an object URL, then swap to a durable
    // hosted URL in the background once the upload completes — saved
    // designs need a real URL since object URLs die when the tab closes.
    const url = URL.createObjectURL(file);
    const id = crypto.randomUUID();
    const side = activeSide;

    const newArtwork: PlacedArtwork = {
      id,
      src: url,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      scaleX: 0.4,
      scaleY: 0.4,
      rotation: 0,
    };

    setActiveArtworks((prev) => [...prev, newArtwork]);
    setSelectedId(id);
    e.target.value = ""; // allow re-selecting the same file later

    if (signedIn) {
      const form = new FormData();
      form.append("file", file);
      fetch("/api/uploads", { method: "POST", body: form })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { url?: string } | null) => {
          if (!data?.url) return;
          setArtworksBySide((prev) => ({
            ...prev,
            [side]: prev[side].map((a) =>
              a.id === id ? { ...a, src: data.url! } : a,
            ),
          }));
          URL.revokeObjectURL(url);
        })
        .catch(() => {
          // Upload failed — the local object-URL preview still works for
          // this session, it just won't survive a saved design or refresh.
        });
    }
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
      const src = URL.createObjectURL(blob);
      const id = crypto.randomUUID();
      setActiveArtworks((prev) => [
        ...prev,
        {
          id,
          src,
          x: CANVAS_SIZE / 2,
          y: CANVAS_SIZE / 2,
          scaleX: 0.45,
          scaleY: 0.45,
          rotation: 0,
        },
      ]);
      setSelectedId(id);
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

  function handleApprove() {
    // Export the selected side locally. Persistence is intentionally deferred.
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (dataUrl) setExportedUrl(dataUrl);
    setApproved(true);
    setTimeout(() => setApproved(false), 2000);
  }

  function addDesignToCart() {
    if (!productDetail) return;
    const otherSide: GarmentSide = activeSide === "front" ? "back" : "front";
    const hasOtherSideArt = artworksBySide[otherSide].length > 0;
    const artworkProofUrl = stageRef.current?.toDataURL({ pixelRatio: 2 });
    const printLabel = `${placementBySide[activeSide]} (${GARMENT_VIEWS[activeSide].label.toLowerCase()})${
      hasOtherSideArt
        ? ` + ${placementBySide[otherSide]} (${GARMENT_VIEWS[otherSide].label.toLowerCase()})`
        : ""
    }`;
    const productName =
      `${productDetail.style.brandName} ${productDetail.style.styleName}`.trim();

    if (groupOrder) {
      if (roster.length === 0) {
        setRosterError("Add at least one person.");
        return;
      }
      if (roster.some((r) => !r.name.trim())) {
        setRosterError("Every row needs a name.");
        return;
      }
      const priceVariant =
        productDetail.variants.find((v) => v.sizeName === roster[0]!.size) ??
        selectedVariant;
      if (!priceVariant) return;
      setRosterError(null);
      addItem({
        id: productDetail.product.id,
        productId: productDetail.product.id,
        styleId: productDetail.style.id,
        variantId: priceVariant.id,
        name: productName,
        meta: `Custom design · Team order · ${roster.length} pieces, mixed sizes · ${printLabel}`,
        color: productDetail.product.colorName,
        qty: roster.length,
        unit: priceVariant.retailMinor / 100,
        image: currentPhoto || "",
        artworkProofUrl,
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
      unit: selectedVariant.retailMinor / 100,
      image: currentPhoto || "",
      artworkProofUrl,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
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
      const proofImageUrl = stageRef.current?.toDataURL({ pixelRatio: 2 }) ?? null;
      const payload = {
        name: designName.trim(),
        garmentProductId: selectedGarmentId,
        artworksBySide,
        proofImageUrl,
      };
      const response = await fetch(
        savedDesignId ? `/api/designs/${savedDesignId}` : "/api/designs",
        {
          method: savedDesignId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
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
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1.4fr_1fr] gap-sp-3 items-stretch">
      {/* Assets column */}
      <aside className="bg-bg-raised border border-border rounded-lg p-sp-4 flex flex-col gap-2.5">
        {garmentOptions.length > 0 && (
          <div className="mb-sp-2">
            <h4 className="font-display text-[16px] mb-sp-2">Garment</h4>
            <select
              value={selectedGarmentId ?? ""}
              onChange={(e) => setSelectedGarmentId(e.target.value || null)}
              className="w-full border border-border rounded-sm bg-bg px-2.5 py-2 text-[13px] font-semibold"
            >
              {garmentOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label} · {g.colorName}
                </option>
              ))}
            </select>
          </div>
        )}

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
              className="w-full min-h-24 resize-y rounded-sm border border-border bg-bg-raised p-2.5 text-sm outline-none focus:border-accent"
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
              {GARMENT_VIEWS[activeSide].label} layers
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
      </aside>

      {/* Canvas */}
      <div className="bg-text-primary text-white rounded-lg overflow-hidden flex flex-col">
        <div className="px-sp-4 py-sp-3 flex justify-between items-center border-b border-white/10">
          <div>
            <b className="font-display text-[15px]">2D Design Canvas</b>
            <span className="block text-[11px] text-white/55 mt-0.5">
              {GARMENT_VIEWS[activeSide].label} side · independent artwork
            </span>
          </div>
          <label className="relative">
            <span className="sr-only">Placement zone</span>
            <select
              value={placementBySide[activeSide]}
              onChange={(e) =>
                setPlacementBySide((prev) => ({ ...prev, [activeSide]: e.target.value }))
              }
              className="bg-accent text-white text-xs font-bold pl-3 pr-7 py-1.5 rounded-md appearance-none cursor-pointer"
            >
              {PLACEMENT_ZONES[activeSide].map((zone) => (
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
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
        </div>

        <div className="p-sp-3 grid grid-cols-1 sm:grid-cols-[60px_1fr] gap-sp-3 min-h-[340px] overflow-x-auto">
          <div className="flex flex-row sm:flex-col gap-2">
            {(Object.entries(GARMENT_VIEWS) as [GarmentSide, (typeof GARMENT_VIEWS)[GarmentSide]][]).map(([side, view]) => (
              <button
                key={side}
                onClick={() => {
                  setActiveSide(side);
                  setExportedUrl(null);
                }}
                aria-label={`Edit ${view.label.toLowerCase()} side`}
                title={`${view.label} side — ${artworksBySide[side].length} artwork layer${artworksBySide[side].length === 1 ? "" : "s"} placed`}
                className={cn(
                  "w-[72px] sm:w-[60px] h-[70px] rounded-md bg-[#1a1a1a] grid place-items-center border-[1.5px] text-[10px] font-bold overflow-hidden py-1.5",
                  activeSide === side ? "border-accent text-white" : "border-transparent text-white/55"
                )}
              >
                <span>
                  {photoBySide[side] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoBySide[side]!}
                      alt=""
                      className="block w-8 h-6 mx-auto mb-0.5 rounded-sm object-cover object-top"
                    />
                  ) : (
                    <span
                      className={cn(
                        "block w-8 h-7 mx-auto mb-1 rounded-sm",
                        side === "back" && "-scale-x-100"
                      )}
                      style={{ background: view.color }}
                    />
                  )}
                  {view.label}
                  <span className="block text-[9px] font-normal normal-case opacity-80">
                    {artworksBySide[side].length} layer
                    {artworksBySide[side].length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="bg-[#141414] rounded-md flex items-center justify-center p-sp-3 min-w-[340px]">
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
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <RecolorGarment
                  maskSrc="/images/t-shirt.png"
                  color={GARMENT_VIEWS[activeSide].color}
                  className={cn("absolute inset-0", activeSide === "back" && "-scale-x-100")}
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
          <b className="font-display text-[15px]">Proof Preview</b>
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
                className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]"
              />
            ) : (
              <RecolorGarment
                maskSrc="/images/t-shirt.png"
                color={GARMENT_VIEWS[activeSide].color}
                className={cn(
                  "absolute inset-0 drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]",
                  activeSide === "back" && "-scale-x-100"
                )}
              />
            )}
            {exportedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={exportedUrl}
                alt={`${GARMENT_VIEWS[activeSide].label} artwork preview`}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            {!currentPhoto && (
              <span className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-text-tertiary">
                Representative {GARMENT_VIEWS[activeSide].label.toLowerCase()} silhouette
              </span>
            )}
          </div>
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
                  className="flex-1 min-w-0 rounded-sm border border-border bg-bg-raised px-2.5 py-2 text-sm outline-none focus:border-accent"
                />
                <button
                  onClick={handleSaveDesign}
                  disabled={saving}
                  className="shrink-0 rounded-sm bg-text-primary px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {saving ? "Saving…" : savedDesignId ? "Update" : "Save"}
                </button>
              </div>
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
                ? `Add artwork to the ${GARMENT_VIEWS[activeSide].label.toLowerCase()} first`
                : `Export ${GARMENT_VIEWS[activeSide].label} Artwork`}
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

          {productDetail && (
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

              <Button
                className="w-full"
                variant="primary"
                disabled={
                  groupOrder
                    ? roster.length === 0
                    : !selectedVariant?.active || (selectedVariant?.qty ?? 0) <= 0
                }
                onClick={addDesignToCart}
              >
                {groupOrder
                  ? addedToCart
                    ? "Added ✓"
                    : `Add ${roster.length.toLocaleString()} Piece${roster.length === 1 ? "" : "s"} to Cart`
                  : !selectedVariant || selectedVariant.qty <= 0
                    ? "Unavailable"
                    : addedToCart
                      ? "Added ✓"
                      : `Add ${designQty.toLocaleString()} Piece${designQty === 1 ? "" : "s"} to Cart · ${moneyFromMinor(
                          selectedVariant.retailMinor * designQty,
                        )}`}
              </Button>
            </div>
          )}
        </div>
      </div>
      <p className="lg:col-span-3 text-xs text-text-tertiary">
        3D artwork preview is unavailable because no UV-mapped garment model is
        included. Existing 3D media is reference footage, not an artwork-accurate
        interactive preview.
      </p>
    </div>
  );
}
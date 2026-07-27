"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { RecolorGarment } from "@/components/pdp/RecolorGarment";
import type { PlacedArtwork } from "@/components/design/ArtworkLayer";

// react-konva touches the DOM directly — must be client-only, no SSR.
const Stage = dynamic(() => import("react-konva").then((m) => m.Stage), { ssr: false });
const Layer = dynamic(() => import("react-konva").then((m) => m.Layer), { ssr: false });
const ArtworkLayerImpl = dynamic(
  () => import("@/components/design/ArtworkLayer").then((m) => m.ArtworkLayer),
  { ssr: false }
);

const GARMENT_VIEWS = {
  front: { label: "Front", color: "#3a2216" },
  back: { label: "Back", color: "#3a2216" },
} as const;

type GarmentSide = keyof typeof GARMENT_VIEWS;
type ArtworkBySide = Record<GarmentSide, PlacedArtwork[]>;

const CANVAS_SIZE = 340;

export function DesignStudio() {
  const [activeSide, setActiveSide] = useState<GarmentSide>("front");
  const [artworksBySide, setArtworksBySide] = useState<ArtworkBySide>({
    front: [],
    back: [],
  });
  const [selectedBySide, setSelectedBySide] = useState<
    Record<GarmentSide, string | null>
  >({ front: null, back: null });
  const [approved, setApproved] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const artworks = artworksBySide[activeSide];
  const selectedId = selectedBySide[activeSide];

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

    // NOTE: using a local object URL so this works today with no backend.
    // Once a storage decision is made (S3 / Cloudinary / etc.), swap this
    // for a real upload call and use the returned hosted URL instead —
    // object URLs die when the tab closes, they are not durable storage.
    const url = URL.createObjectURL(file);
    const id = crypto.randomUUID();

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
  }

  function removeSelected() {
    if (!selectedId) return;
    setActiveArtworks((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }

  function generateConcept() {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      const id = crypto.randomUUID();
      setActiveArtworks((prev) => [
        ...prev,
        {
          id,
          src: "/images/company_logo.png",
          x: CANVAS_SIZE / 2,
          y: CANVAS_SIZE / 2,
          scaleX: 0.45,
          scaleY: 0.45,
          rotation: 0,
        },
      ]);
      setSelectedId(id);
      setGenerating(false);
      setShowAiPrompt(false);
      setAiPrompt("");
    }, 700);
  }

  function handleApprove() {
    // Export the selected side locally. Persistence is intentionally deferred.
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (dataUrl) setExportedUrl(dataUrl);
    setApproved(true);
    setTimeout(() => setApproved(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1.4fr_1fr] gap-sp-3 items-stretch">
      {/* Assets column */}
      <aside className="bg-bg-raised border border-border rounded-lg p-sp-4 flex flex-col gap-2.5">
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
              {generating ? "Building concept…" : "Generate preview"}
            </button>
            <p className="text-[11px] leading-4 text-text-tertiary mt-2">
              Frontend demo: inserts a sample concept so the complete interaction can be reviewed.
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
          <span className="bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-md">
            Zone: {activeSide === "front" ? "Chest" : "Back"}
          </span>
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
                className={cn(
                  "w-[72px] sm:w-[60px] h-[60px] rounded-md bg-[#1a1a1a] grid place-items-center border-[1.5px] text-[10px] font-bold",
                  activeSide === side ? "border-accent text-white" : "border-transparent text-white/55"
                )}
              >
                <span>
                  <span
                    className={cn(
                      "block w-8 h-7 mx-auto mb-1 rounded-sm",
                      side === "back" && "-scale-x-100"
                    )}
                    style={{ background: view.color }}
                  />
                  {view.label} ({artworksBySide[side].length})
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
              {/* Garment layer — reuses the photorealistic recolor approach
                  from the Fabric Wall. Still blocked on real transparent
                  garment photography (see decision #4 above); using the
                  flat silhouette as a stand-in until those assets exist. */}
              <RecolorGarment
                maskSrc="/images/t-shirt.png"
                color={GARMENT_VIEWS[activeSide].color}
                className={cn("absolute inset-0", activeSide === "back" && "-scale-x-100")}
              />

              {/* Artwork layer — real, interactive, exports real pixels */}
              <Stage
                key={activeSide}
                ref={stageRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="absolute inset-0"
              >
                <Layer>
                  {artworks.map((a) => (
                    <ArtworkLayerImpl
                      key={a.id}
                      artwork={a}
                      isSelected={selectedId === a.id}
                      onSelect={() => setSelectedId(a.id)}
                      onChange={(next) =>
                        setActiveArtworks((prev) =>
                          prev.map((p) => (p.id === next.id ? next : p))
                        )
                      }
                    />
                  ))}
                </Layer>
              </Stage>
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
            <RecolorGarment
              maskSrc="/images/t-shirt.png"
              color={GARMENT_VIEWS[activeSide].color}
              className={cn(
                "absolute inset-0 drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]",
                activeSide === "back" && "-scale-x-100"
              )}
            />
            {exportedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={exportedUrl}
                alt={`${GARMENT_VIEWS[activeSide].label} artwork preview`}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            <span className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-text-tertiary">
              Representative {GARMENT_VIEWS[activeSide].label.toLowerCase()} silhouette
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={handleApprove}>
            {approved
              ? "Artwork export ready ✓"
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
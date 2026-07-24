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

const GARMENT_VIEWS = [
  { label: "Front", color: "#3a2216" },
  { label: "Back", color: "#5c2430" },
];

const CANVAS_SIZE = 340;

export function DesignStudio() {
  const [activeView, setActiveView] = useState(0);
  const [artworks, setArtworks] = useState<PlacedArtwork[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);

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

    setArtworks((prev) => [...prev, newArtwork]);
    setSelectedId(id);
    e.target.value = ""; // allow re-selecting the same file later
  }

  function removeSelected() {
    if (!selectedId) return;
    setArtworks((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }

  function handleApprove() {
    // This IS real: exports the actual canvas pixels the customer placed.
    // Still needs a decision on where that PNG gets persisted (see note
    // above) before this can hand off to cart/checkout permanently.
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
          disabled
          title="Coming soon — pending confirmation"
          className="bg-fill-subtle border border-border text-text-tertiary rounded-md py-3 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          ✨ AI Generate
          <span className="text-[10px] font-bold bg-bg-raised border border-border px-1.5 py-0.5 rounded-full">
            Soon
          </span>
        </button>

        {artworks.length > 0 && (
          <div className="mt-sp-3">
            <span className="block text-[11px] font-bold tracking-[0.1em] uppercase text-text-tertiary mb-2">
              Layers
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
          <b className="font-display text-[15px]">Design Canvas</b>
          <span className="bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-md">
            Zone: Chest
          </span>
        </div>

        <div className="p-sp-3 grid grid-cols-[60px_1fr] gap-sp-3 min-h-[340px]">
          <div className="flex flex-col gap-2">
            {GARMENT_VIEWS.map((v, i) => (
              <button
                key={v.label}
                onClick={() => setActiveView(i)}
                className={cn(
                  "w-[60px] h-[60px] rounded-md bg-[#1a1a1a] grid place-items-center border-[1.5px]",
                  activeView === i ? "border-accent" : "border-transparent"
                )}
              >
                <span className="w-9 h-9 rounded-sm" style={{ background: v.color }} />
              </button>
            ))}
          </div>

          <div className="bg-[#141414] rounded-md flex items-center justify-center p-sp-3">
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
                color={GARMENT_VIEWS[activeView].color}
                className="absolute inset-0"
              />

              {/* Artwork layer — real, interactive, exports real pixels */}
              <Stage
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
                        setArtworks((prev) =>
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
          rotate a selected layer.
        </p>
      </div>

      {/* Live mockup */}
      <div className="bg-bg-raised border border-border rounded-lg p-sp-4 flex flex-col">
        <div className="flex justify-between items-center mb-sp-3">
          <b className="font-display text-[15px]">Live Mockup</b>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Live
          </span>
        </div>

        <div className="flex-1 min-h-[280px] rounded-md border border-border bg-[radial-gradient(80%_90%_at_50%_15%,#fff,#E8E5DC_70%,#D6D2C7_100%)] flex items-center justify-center p-sp-3 mb-sp-3 overflow-hidden">
          {exportedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={exportedUrl}
              alt="Approved design preview"
              className="max-w-[85%] max-h-full drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]"
            />
          ) : (
            <div className="relative w-3/4 max-w-[280px] aspect-square">
              <RecolorGarment
                maskSrc="/images/t-shirt.png"
                color={GARMENT_VIEWS[activeView].color}
                className="absolute inset-0 drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={handleApprove}>
            {approved ? "Approved ✓" : "Approve Design"}
          </Button>
          {exportedUrl && (
            <p className="text-[12px] text-text-tertiary text-center -mt-1">
              This exported preview is stored only in this browser tab right
              now — persisting it to your account/cart is pending the storage
              decision.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
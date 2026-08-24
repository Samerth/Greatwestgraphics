"use client";

import { DESIGN_SIDE_LABELS, DesignSides, type DesignSide } from "@gwg/contracts";
import { StudioColorSwatches } from "@/components/design/StudioColorSwatches";
import { StudioFontPicker } from "@/components/design/StudioFontPicker";
import { cn } from "@/lib/utils/cn";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 mb-1">
        <span>{label}</span>
        <span className="normal-case tracking-normal text-white/70">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-white"
      />
    </label>
  );
}

export function StudioElementEditor({
  kind,
  activeSide,
  text,
  onPatchText,
  onPatchArtwork,
  outline,
  rotation,
  size,
  onOutline,
  onRotation,
  onSize,
  onCenter,
  onForward,
  onBack,
  onDuplicate,
  onDelete,
  onMoveToSide,
  onSliderCommit,
}: {
  kind: "text" | "artwork";
  activeSide: DesignSide;
  text?: {
    align: "left" | "center" | "right";
    printMethod: "print" | "embroidery";
    fill: string;
    fontFamily: string;
    letterSpacing: number;
    arc: number;
    sample: string;
  };
  onPatchText?: (
    patch: Partial<{
      align: "left" | "center" | "right";
      printMethod: "print" | "embroidery";
      fill: string;
      fontFamily: string;
      letterSpacing: number;
      arc: number;
    }>,
  ) => void;
  onPatchArtwork?: (patch: { outline?: boolean }) => void;
  outline: boolean;
  rotation: number;
  size: number;
  onOutline: (next: boolean) => void;
  onRotation: (next: number) => void;
  onSize: (next: number) => void;
  onCenter: () => void;
  onForward: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveToSide: (side: DesignSide) => void;
  onSliderCommit: () => void;
}) {
  return (
    <div className="border-t border-white/10 px-sp-4 py-sp-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <b className="font-display text-[13px] text-white">
          Edit {kind === "text" ? "text" : "artwork"}
        </b>
        <label className="flex items-center gap-2 text-[11px] font-bold text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={outline}
            onChange={(event) => onOutline(event.target.checked)}
          />
          Outline
        </label>
      </div>

      {text && onPatchText ? (
        <>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onPatchText({ align })}
                className={cn(
                  "flex-1 h-7 rounded-sm border text-[11px] font-bold capitalize",
                  text.align === align
                    ? "bg-white text-text-primary border-white"
                    : "border-white/20 text-white/70 hover:border-white/40",
                )}
              >
                {align}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["print", "embroidery"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPatchText({ printMethod: method })}
                className={cn(
                  "flex-1 h-7 rounded-sm border text-[11px] font-bold capitalize",
                  text.printMethod === method
                    ? "bg-white text-text-primary border-white"
                    : "border-white/20 text-white/70 hover:border-white/40",
                )}
              >
                {method}
              </button>
            ))}
          </div>
          <StudioColorSwatches
            value={text.fill}
            onChange={(fill) => onPatchText({ fill })}
          />
          <StudioFontPicker
            tone="canvas"
            value={text.fontFamily}
            onChange={(fontFamily) => onPatchText({ fontFamily })}
            sample={text.sample || "Great West"}
          />
          <SliderRow
            label="Arc"
            value={text.arc}
            min={-120}
            max={120}
            suffix="°"
            onChange={(arc) => onPatchText({ arc })}
            onCommit={onSliderCommit}
          />
          <SliderRow
            label="Spacing"
            value={text.letterSpacing}
            min={-4}
            max={24}
            step={0.5}
            onChange={(letterSpacing) => onPatchText({ letterSpacing })}
            onCommit={onSliderCommit}
          />
        </>
      ) : null}

      <SliderRow
        label="Size"
        value={size}
        min={kind === "text" ? 10 : 8}
        max={kind === "text" ? 96 : 220}
        onChange={onSize}
        onCommit={onSliderCommit}
      />
      <SliderRow
        label="Rotate"
        value={Math.round(rotation)}
        min={-180}
        max={180}
        suffix="°"
        onChange={onRotation}
        onCommit={onSliderCommit}
      />

      <div className="flex flex-wrap gap-1.5">
        <EditorAction onClick={onCenter}>Center</EditorAction>
        <EditorAction onClick={onForward}>Forward</EditorAction>
        <EditorAction onClick={onBack}>Back</EditorAction>
        <EditorAction onClick={onDuplicate}>Duplicate</EditorAction>
        <EditorAction onClick={onDelete} danger>
          Delete
        </EditorAction>
      </div>

      <div>
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 mb-1.5">
          Move design location
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {DesignSides.map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => onMoveToSide(side)}
              disabled={side === activeSide}
              className={cn(
                "h-8 rounded-sm border text-[11px] font-bold transition-colors",
                side === activeSide
                  ? "border-accent bg-accent/20 text-white"
                  : "border-white/20 text-white/80 hover:border-white/50",
              )}
            >
              {DESIGN_SIDE_LABELS[side]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorAction({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2 rounded-sm border text-[11px] font-bold transition-colors",
        danger
          ? "border-red-400/40 text-red-200 hover:bg-red-500/20"
          : "border-white/20 text-white/80 hover:border-white/50 hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

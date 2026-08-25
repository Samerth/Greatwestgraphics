"use client";

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

/** Left / Center / Right snap a layer into the 5×5 front chest boxes. */
export function StudioChestAlign({
  value,
  onChange,
  tone = "panel",
  compact,
}: {
  value: "left" | "center" | "right" | null;
  onChange: (align: "left" | "center" | "right") => void;
  tone?: "panel" | "canvas";
  compact?: boolean;
}) {
  const canvas = tone === "canvas";
  return (
    <div
      className={cn(
        compact
          ? "flex items-center gap-2 min-w-[13.5rem] max-w-[18rem] flex-1"
          : "min-w-0",
      )}
    >
      <span
        className={cn(
          "font-bold uppercase tracking-[0.12em]",
          compact ? "text-[10px] shrink-0" : "block text-[10px] mb-1.5",
          canvas ? "text-white/45" : "text-text-tertiary",
        )}
      >
        Chest
      </span>
      <div
        className="flex gap-1 min-w-0 flex-1"
        role="group"
        aria-label="Chest placement"
      >
        {(["left", "center", "right"] as const).map((align) => (
          <button
            key={align}
            type="button"
            aria-label={`${align} chest`}
            aria-pressed={value === align}
            onClick={() => onChange(align)}
            className={cn(
              "flex-1 h-8 rounded-sm border text-[12px] font-bold capitalize transition-colors",
              value === align
                ? canvas
                  ? "bg-white text-text-primary border-white"
                  : "bg-accent text-white border-accent"
                : canvas
                  ? "border-white/20 text-white/80 hover:border-white/50"
                  : "border-border hover:border-text-tertiary",
            )}
          >
            {align}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StudioElementEditor({
  kind,
  text,
  onPatchText,
  outline,
  rotation,
  size,
  onOutline,
  onRotation,
  onSize,
  onForward,
  onBack,
  onDuplicate,
  onDelete,
  onSliderCommit,
  className,
}: {
  kind: "text" | "artwork";
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
  outline: boolean;
  rotation: number;
  size: number;
  onOutline: (next: boolean) => void;
  onRotation: (next: number) => void;
  onSize: (next: number) => void;
  onForward: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSliderCommit: () => void;
  className?: string;
}) {
  return (
    <div className={cn("px-sp-4 py-sp-3 flex flex-col gap-3", className)}>
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

      {text && onPatchText ? (
        <>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 mb-1.5">
              Text align
            </span>
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

      <div className="flex flex-wrap gap-1.5">
        <EditorAction
          onClick={onForward}
          title="Bring this layer in front of the others"
        >
          Bring forward
        </EditorAction>
        <EditorAction
          onClick={onBack}
          title="Send this layer behind the others"
        >
          Send backward
        </EditorAction>
        <EditorAction
          onClick={onDuplicate}
          title="Copy the selected artwork or text"
        >
          Duplicate
        </EditorAction>
        <EditorAction
          onClick={onDelete}
          danger
          title="Remove the selected artwork or text"
        >
          Delete
        </EditorAction>
      </div>
    </div>
  );
}

function EditorAction({
  children,
  onClick,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
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

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
      <span className="flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-1">
        <span>{label}</span>
        <span className="normal-case tracking-normal text-text-secondary">
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
        className="w-full accent-[color:var(--color-accent)]"
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

/**
 * The back's equivalent of StudioChestAlign. The back has no left/right
 * zones to choose between — detectPlacementZone never splits a back mark by
 * horizontal position — but it does have a real size choice: a small
 * centred mark, or filling the whole plate (Pavin, client meeting: "Back
 * view doesn't have the position options").
 */
export function StudioBackSizeToggle({
  value,
  onChange,
  tone = "panel",
  compact,
}: {
  value: "mark" | "full" | null;
  onChange: (choice: "mark" | "full") => void;
  tone?: "panel" | "canvas";
  compact?: boolean;
}) {
  const canvas = tone === "canvas";
  const OPTIONS = [
    { key: "mark" as const, label: "Mark" },
    { key: "full" as const, label: "Full Back" },
  ];
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
        Size
      </span>
      <div
        className="flex gap-1 min-w-0 flex-1"
        role="group"
        aria-label="Back placement size"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-label={option.label}
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex-1 h-8 rounded-sm border text-[12px] font-bold transition-colors",
              value === option.key
                ? canvas
                  ? "bg-white text-text-primary border-white"
                  : "bg-accent text-white border-accent"
                : canvas
                  ? "border-white/20 text-white/80 hover:border-white/50"
                  : "border-border hover:border-text-tertiary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The sleeve's equivalent of StudioChestAlign. A sleeve print area is a
 * single small box with no left/right or size choice inside it — "Sleeve"
 * and "Side Panel" are the same box and the same fit, so a toggle between
 * them would be two buttons that do the same thing. What genuinely helps is
 * putting the mark back in the middle after it's been dragged off-centre.
 */
export function StudioSleeveCenter({
  onCenter,
  tone = "panel",
  compact,
}: {
  onCenter: () => void;
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
        Position
      </span>
      <button
        type="button"
        onClick={onCenter}
        className={cn(
          "h-8 rounded-sm border px-3 text-[12px] font-bold transition-colors",
          canvas
            ? "border-white/20 text-white/80 hover:border-white/50"
            : "border-border hover:border-text-tertiary",
        )}
      >
        Center
      </button>
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
  onRemoveBackground,
  removingBackground = false,
  removeBackgroundSvgNote = false,
  onSliderCommit,
  moveTo,
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
  /** UAT row 61 - present only when a paid image provider is configured. */
  onRemoveBackground?: () => void;
  removingBackground?: boolean;
  /** True when this layer is an SVG and background removal is otherwise
   * available — shows an explanatory note in place of the button, rather
   * than the button existing and failing on the one file type it can't
   * process (Pavin, client meeting: SVG uploads hit "Use a PNG, JPG or
   * WEBP" from the remover after already being accepted by the uploader). */
  removeBackgroundSvgNote?: boolean;
  onSliderCommit: () => void;
  /** The other sides this layer could move to, and the handler to do it.
   * Explicit and separate from clicking a side thumbnail to look at it —
   * see DesignStudio.tsx for why those used to be the same click. */
  moveTo?: {
    options: { id: string; label: string }[];
    onMove: (side: string) => void;
  };
  className?: string;
}) {
  return (
    <div className={cn("px-sp-4 py-sp-3 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <b className="font-display text-[13px] text-text-primary">
          Edit {kind === "text" ? "text" : "artwork"}
        </b>
        <label className="flex items-center gap-2 text-[11px] font-bold text-text-secondary cursor-pointer">
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
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-1.5">
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
                      ? "bg-accent text-white border-accent"
                      : "border-border text-text-secondary hover:border-text-tertiary",
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
                    ? "bg-accent text-white border-accent"
                    : "border-border text-text-secondary hover:border-text-tertiary",
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
            tone="panel"
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

      {moveTo && moveTo.options.length > 0 && (
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-1.5">
            Move to
          </span>
          <div className="flex flex-wrap gap-1.5">
            {moveTo.options.map((option) => (
              <EditorAction key={option.id} onClick={() => moveTo.onMove(option.id)} title={`Move to ${option.label}`}>
                {option.label}
              </EditorAction>
            ))}
          </div>
        </div>
      )}

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
        {onRemoveBackground && (
          /* UAT row 61. Only offered when the paid image provider is on;
             the studio passes nothing otherwise and the button does not
             exist, rather than existing and failing. */
          <EditorAction
            onClick={onRemoveBackground}
            title="Strip a flat background from this logo so only the artwork prints"
          >
            {removingBackground ? "Removing background…" : "Remove background"}
          </EditorAction>
        )}
        <EditorAction
          onClick={onDelete}
          danger
          title="Remove the selected artwork or text"
        >
          Delete
        </EditorAction>
      </div>
      {removeBackgroundSvgNote && (
        <p className="m-0 text-[11px] leading-4 text-text-tertiary">
          Vector files (SVG) don&rsquo;t need background removal — they&rsquo;re
          already just the shapes you see, with no background pixels to strip
          out. Works on PNG, JPG and WEBP.
        </p>
      )}
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
          ? "border-red-300 text-red-700 hover:bg-red-50"
          : "border-border text-text-secondary hover:border-text-tertiary hover:bg-fill-subtle-15",
      )}
    >
      {children}
    </button>
  );
}

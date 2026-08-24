"use client";

import type { TextAlign, TextPrintMethod } from "@gwg/contracts";
import { StudioColorSwatches } from "@/components/design/StudioColorSwatches";
import { StudioFontPicker } from "@/components/design/StudioFontPicker";
import { cn } from "@/lib/utils/cn";

const ALIGNS: { value: TextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const METHODS: { value: TextPrintMethod; label: string }[] = [
  { value: "print", label: "Print" },
  { value: "embroidery", label: "Embroidery" },
];

export function StudioTextPanel({
  draft,
  onDraftChange,
  align,
  onAlignChange,
  printMethod,
  onPrintMethodChange,
  fill,
  onFillChange,
  fontId,
  onFontChange,
  onAdd,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  align: TextAlign;
  onAlignChange: (value: TextAlign) => void;
  printMethod: TextPrintMethod;
  onPrintMethodChange: (value: TextPrintMethod) => void;
  fill: string;
  onFillChange: (value: string) => void;
  fontId: string;
  onFontChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        Add text
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Type your text"
          rows={2}
          className="mt-1.5 w-full resize-y rounded-sm border border-border bg-bg-raised px-2.5 py-2 text-sm font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <button
        type="button"
        onClick={onAdd}
        disabled={!draft.trim()}
        className="border border-dashed border-border rounded-md py-3 font-bold text-sm hover:border-accent hover:text-accent hover:bg-accent-tint transition-colors disabled:opacity-40"
      >
        Add text to this side
      </button>

      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        Alignment
      </span>
      <div className="flex gap-1">
        {ALIGNS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onAlignChange(option.value)}
            className={cn(
              "flex-1 h-8 rounded-sm border text-[12px] font-bold transition-colors",
              align === option.value
                ? "bg-accent text-white border-accent"
                : "border-border hover:border-text-tertiary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        Print method
      </span>
      <div className="flex gap-1">
        {METHODS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPrintMethodChange(option.value)}
            className={cn(
              "flex-1 h-8 rounded-sm border text-[12px] font-bold transition-colors",
              printMethod === option.value
                ? "bg-accent text-white border-accent"
                : "border-border hover:border-text-tertiary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        Colour
      </span>
      <StudioColorSwatches value={fill} onChange={onFillChange} />

      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        Font
      </span>
      <StudioFontPicker value={fontId} onChange={onFontChange} sample={draft.trim() || "Great West"} />
    </div>
  );
}

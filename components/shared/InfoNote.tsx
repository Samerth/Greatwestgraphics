"use client";

/**
 * A small "i" toggle that reveals one line of explanatory text — used for
 * surfacing an existing surcharge or option without implying it's
 * selectable here (e.g. "2XL+ sizes carry an additional surcharge").
 * Shared between the PDP Live Estimate Calculator and the actual buy box
 * so this kind of disclosure looks and behaves identically everywhere it
 * appears, rather than drifting into slightly different one-off copies.
 */
export function InfoNote({
  id,
  label,
  detail,
  open,
  onToggle,
}: {
  id: string;
  label: string;
  detail: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-left hover:text-text-primary"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`info-${id}`}
      >
        <span className="inline-flex w-3.5 h-3.5 rounded-full border border-text-tertiary items-center justify-center text-[10px] font-bold shrink-0">
          i
        </span>
        {label}
      </button>
      {open && (
        <p id={`info-${id}`} className="pl-5 mt-0.5 text-text-secondary">
          {detail}
        </p>
      )}
    </div>
  );
}

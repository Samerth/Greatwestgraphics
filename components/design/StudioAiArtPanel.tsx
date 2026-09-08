"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  History,
  Minimize2,
  PartyPopper,
  PenLine,
  Shapes,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import {
  STUDIO_AI_PURPOSE_MAX,
  STUDIO_AI_STYLES,
  STUDIO_AI_SUBJECTS_MAX,
  type StudioAiStyleId,
} from "@/lib/commerce/studio-ai-identity";
import { cn } from "@/lib/utils/cn";

const STYLE_ICONS: Record<StudioAiStyleId, typeof Sparkles> = {
  badge: Shapes,
  "line-art": PenLine,
  vintage: History,
  mascot: Smile,
  minimal: Minimize2,
  playful: PartyPopper,
};

export type StudioAiArtPanelProps = {
  purpose: string;
  onPurposeChange: (value: string) => void;
  subjects: string;
  onSubjectsChange: (value: string) => void;
  styleId: StudioAiStyleId;
  onStyleChange: (id: StudioAiStyleId) => void;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

/**
 * The Design Studio's AI Art modal. Same overlay shell as
 * StudioSizeChartModal (backdrop + centered panel, Escape closes, body
 * scroll locked), but rendered through `createPortal` to `document.body` —
 * this trigger sits inside the studio's sidebar, which the canvas column's
 * zoom/pan transform turns into a new containing block for any descendant
 * `position: fixed` element. Without the portal the panel still painted at
 * the right screen position, but the Konva canvas (a sibling outside that
 * transformed ancestor) painted over it in the overlap — caught by an actual
 * screenshot, not assumed. `PricingDetailsPopover.tsx` hit the same class of
 * bug earlier and portals for the same reason.
 *
 * Coastal Reign's own version of this modal opens on a "how would you like
 * to start?" chooser between generating from scratch and starting from an
 * uploaded photo. Only the from-scratch path exists here — the current free
 * generator (FLUX.1-schnell / Pollinations) is text-only, so an
 * image-to-image option would either not work or need a different backend.
 * Rather than show a chooser with one live card and one disabled one, this
 * opens straight into the form; the chooser is easy to bring back once
 * there's a second real path.
 *
 * Purely presentational — every field is controlled from DesignStudio.tsx,
 * and "Generate" just calls `onGenerate`. The panel never builds a prompt or
 * talks to a generator itself (see lib/commerce/studio-ai-identity.ts for
 * that boundary) — so it looks and behaves the same regardless of which
 * backend ends up behind /api/studio/identity.
 */
export function StudioAiArtPanel({
  purpose,
  onPurposeChange,
  subjects,
  onSubjectsChange,
  styleId,
  onStyleChange,
  generating,
  error,
  onGenerate,
  onClose,
}: StudioAiArtPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !generating) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, generating]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const canGenerate = purpose.trim().length >= 2 && !generating;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[80]"
        onClick={() => !generating && onClose()}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[81] flex items-end lg:items-center lg:justify-center p-0 lg:p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="AI Design Assistant"
          className="bg-bg-raised w-full lg:w-full lg:max-w-xl rounded-t-lg lg:rounded-lg border border-border lg:shadow-2xl max-h-[92vh] overflow-y-auto"
        >
          <div className="sticky top-0 z-10 bg-band px-sp-5 py-sp-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Sparkles size={20} strokeWidth={2.25} aria-hidden />
              <h2 className="font-display font-bold text-lg m-0">AI Design Assistant</h2>
            </div>
            <button
              type="button"
              onClick={() => !generating && onClose()}
              disabled={generating}
              aria-label="Close"
              className="text-white/80 hover:text-white transition-colors disabled:opacity-40"
            >
              <X size={22} aria-hidden />
            </button>
          </div>

          <div className="p-sp-5">
            <div className="mb-sp-4">
              <label
                htmlFor="ai-art-purpose"
                className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2"
              >
                What is this design for?
              </label>
              <textarea
                id="ai-art-purpose"
                value={purpose}
                onChange={(e) => onPurposeChange(e.target.value)}
                placeholder="e.g. Company softball team, Trail-crew reunion, Local coffee shop logo"
                maxLength={STUDIO_AI_PURPOSE_MAX}
                className="w-full min-h-16 resize-y rounded-md border border-border bg-bg p-3 text-sm font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="mb-sp-4">
              <label
                htmlFor="ai-art-subjects"
                className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2"
              >
                Any objects, symbols, or images you want included?{" "}
                <span className="normal-case font-normal text-text-tertiary/70">
                  (optional)
                </span>
              </label>
              <textarea
                id="ai-art-subjects"
                value={subjects}
                onChange={(e) => onSubjectsChange(e.target.value)}
                placeholder="e.g. A mountain peak, Crossed paddles, A coffee cup"
                maxLength={STUDIO_AI_SUBJECTS_MAX}
                className="w-full min-h-14 resize-y rounded-md border border-border bg-bg p-3 text-sm font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="mb-sp-4">
              <span className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                Style
              </span>
              <div className="grid grid-cols-3 gap-2">
                {STUDIO_AI_STYLES.map((style) => {
                  const Icon = STYLE_ICONS[style.id];
                  const active = style.id === styleId;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => onStyleChange(style.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-md border-2 px-2 py-3 text-center transition-colors",
                        active
                          ? "border-accent bg-accent-tint text-accent"
                          : "border-border text-text-secondary hover:border-text-tertiary",
                      )}
                    >
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                      <span className="text-[11px] font-bold leading-tight">
                        {style.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-text-tertiary">
                {STUDIO_AI_STYLES.find((s) => s.id === styleId)?.blurb}
              </p>
            </div>

            {error && (
              <p className="text-[12px] leading-4 text-red-600 mb-sp-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => !generating && onClose()}
                disabled={generating}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-bold hover:border-text-tertiary transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onGenerate}
                disabled={!canGenerate}
                className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Sparkles size={16} strokeWidth={2.25} className="animate-pulse" aria-hidden />
                    Building your design… (up to a minute)
                  </>
                ) : (
                  <>
                    <Sparkles size={16} strokeWidth={2.25} aria-hidden />
                    Generate and place on garment
                  </>
                )}
              </button>
            </div>
            <p className="mt-sp-3 text-[11px] leading-4 text-text-tertiary text-center">
              Free try-out — not print-ready. Keep it if it matches, or try
              again with a different style.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

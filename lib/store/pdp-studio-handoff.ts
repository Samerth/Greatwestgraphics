import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RosterRow } from "@/components/shared/RosterEditor";

export type PdpStudioHandoff = {
  productId: string;
  variantId?: string;
  sizeName?: string;
  qty?: number;
  roster?: RosterRow[];
  groupOrder?: boolean;
  /** Decoration choices made in the PDP's Detailed Quote block, so
   * "Start Designing" opens on the same method/side instead of defaults.
   * methodKey/location/etc. mirror the first (primary) decoration row for
   * DesignStudio's existing single-side handoff logic; `decorations` carries
   * the full multi-row selection for future use once Design Studio supports
   * importing more than one decoration from the handoff. */
  methodKey?: string;
  location?: string;
  colours?: number;
  stitchPreset?: string;
  optionKey?: string;
  decorations?: Array<{
    methodKey: string;
    location: string;
    colours?: number;
    stitchPreset?: string;
    optionKey?: string;
  }>;
};

interface PdpStudioHandoffState {
  handoff: PdpStudioHandoff | null;
  save: (next: PdpStudioHandoff) => void;
  consume: (productId: string) => PdpStudioHandoff | null;
}

/**
 * Size, qty, and any roster started on the PDP, so "Design this" does not
 * drop that work. Session-only — not a second cart.
 */
export const usePdpStudioHandoff = create<PdpStudioHandoffState>()(
  persist(
    (set, get) => ({
      handoff: null,
      save: (next) => set({ handoff: next }),
      consume: (productId) => {
        const current = get().handoff;
        if (!current || current.productId !== productId) return null;
        set({ handoff: null });
        return current;
      },
    }),
    { name: "gwg-pdp-studio-handoff" },
  ),
);

export function rosterLooksStarted(rows: RosterRow[] | undefined): boolean {
  return Boolean(rows?.some((row) => row.name.trim() || row.number.trim()));
}

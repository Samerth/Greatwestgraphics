import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  designDocumentHasArtwork,
  emptyDesignDocument,
  normalizeDesignDocument,
  type DesignDocument,
} from "@gwg/contracts";

interface ActiveDesignState {
  name: string;
  garmentProductId: string | null;
  design: DesignDocument;
  savedDesignId: string | null;
  setDesign: (design: {
    name: string;
    garmentProductId: string | null;
    design: DesignDocument;
    savedDesignId?: string | null;
  }) => void;
  setGarment: (garmentProductId: string | null) => void;
  clear: () => void;
}

/**
 * The customer's in-progress or last-saved design, persisted client-side
 * (localStorage) so it follows them while browsing — the "persistent
 * design + 1-click apply" cross-catalog preview approach: no auto-overlay
 * on product thumbnails (S&S gives no per-garment print-zone data for
 * accurate placement), just the real Design Studio pre-loaded on request.
 */
export const useActiveDesignStore = create<ActiveDesignState>()(
  persist(
    (set) => ({
      name: "",
      garmentProductId: null,
      design: emptyDesignDocument(),
      savedDesignId: null,
      setDesign: (next) =>
        set({
          name: next.name,
          garmentProductId: next.garmentProductId,
          design: next.design,
          savedDesignId: next.savedDesignId ?? null,
        }),
      setGarment: (garmentProductId) => set({ garmentProductId }),
      clear: () =>
        set({
          name: "",
          garmentProductId: null,
          design: emptyDesignDocument(),
          savedDesignId: null,
        }),
    }),
    {
      name: "gwg-active-design",
      // A browser holding the pre-sleeve `artworksBySide` shape from a
      // previous visit still has a real design in it; migrating on read
      // keeps that customer's work instead of silently starting them over.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<ActiveDesignState> & {
          artworksBySide?: unknown;
        };
        return {
          ...state,
          design: normalizeDesignDocument(
            state.design ?? state.artworksBySide,
          ),
        } as ActiveDesignState;
      },
      version: 2,
    },
  ),
);

export function hasActiveArtwork(design: DesignDocument): boolean {
  return designDocumentHasArtwork(design);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlacedArtwork } from "@/components/design/ArtworkLayer";

export type ActiveDesignArtworks = {
  front: PlacedArtwork[];
  back: PlacedArtwork[];
  side?: PlacedArtwork[];
};

const EMPTY_ARTWORKS: ActiveDesignArtworks = { front: [], back: [], side: [] };

interface ActiveDesignState {
  name: string;
  garmentProductId: string | null;
  artworksBySide: ActiveDesignArtworks;
  savedDesignId: string | null;
  setDesign: (design: {
    name: string;
    garmentProductId: string | null;
    artworksBySide: ActiveDesignArtworks;
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
      artworksBySide: EMPTY_ARTWORKS,
      savedDesignId: null,
      setDesign: (design) =>
        set({
          name: design.name,
          garmentProductId: design.garmentProductId,
          artworksBySide: design.artworksBySide,
          savedDesignId: design.savedDesignId ?? null,
        }),
      setGarment: (garmentProductId) => set({ garmentProductId }),
      clear: () =>
        set({
          name: "",
          garmentProductId: null,
          artworksBySide: EMPTY_ARTWORKS,
          savedDesignId: null,
        }),
    }),
    { name: "gwg-active-design" },
  ),
);

export function hasActiveArtwork(artworksBySide: ActiveDesignArtworks): boolean {
  return (
    artworksBySide.front.length > 0 ||
    artworksBySide.back.length > 0 ||
    (artworksBySide.side?.length ?? 0) > 0
  );
}

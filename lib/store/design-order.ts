import { create } from "zustand";
import { persist } from "zustand/middleware";

/** One person on a team order, as captured in the Design Studio.
 *
 * Deliberately no `size` field: names and numbers are a *design* decision
 * (they get printed on the garment, and the customer wants to see them on
 * the mockup while typing), whereas the size each person takes is an
 * *ordering* decision that belongs with every other quantity input on the
 * Input Quantity step. Splitting the old combined roster this way is what
 * lets the studio stop asking order questions — the size lands back on the
 * row in step 2, keyed by position. */
export interface DesignRosterName {
  name: string;
  number: string;
}

/** Decoration choices made while designing — method, and whichever extra
 * input that method needs (stitch count for embroidery, an option key for
 * matrix-priced transfers, an ink-colour count for screen print).
 *
 * These stay with the design rather than moving to step 2 because the
 * client asked for them at the moment artwork is added: they describe how
 * the artwork is *made*, not how many are ordered. Step 2 reads them to
 * price the order without asking the customer again. */
export interface DesignDecoration {
  methodKey: string;
  optionKey: string;
  stitchPreset: string;
  colours: number | null;
}

interface DesignOrderState {
  /** Which garment/colourway the design was built on, so step 2 can load
   *  the same product without a query param that could disagree with the
   *  persisted design. */
  garmentProductId: string | null;
  decoration: DesignDecoration;
  names: DesignRosterName[];
  /** Set once the customer has actually reached step 2 with a real design,
   *  so the step bar can show step 2 as visited/navigable rather than
   *  offering a link into an empty quantity page. */
  reachedQuantity: boolean;
  /** A rendered image of the finished design, uploaded by the studio on the
   *  way out. Step 2 has no canvas of its own, so it cannot produce this —
   *  and an order that reaches production without a proof is the failure
   *  this whole flow exists to avoid. */
  proofUrl: string | null;
  /** The saved design row, when the customer is signed in, so staff can
   *  reopen the editable design rather than only the flat proof. */
  designProjectId: string | null;
  setGarment: (garmentProductId: string | null) => void;
  setDecoration: (patch: Partial<DesignDecoration>) => void;
  setNames: (names: DesignRosterName[]) => void;
  setReachedQuantity: (reached: boolean) => void;
  setProof: (proof: {
    proofUrl: string | null;
    designProjectId: string | null;
  }) => void;
  clear: () => void;
}

const emptyDecoration = (): DesignDecoration => ({
  methodKey: "",
  optionKey: "",
  stitchPreset: "medium",
  colours: null,
});

/**
 * The ordering context that travels from the Design Studio to the Input
 * Quantity step. The design *document* itself already persists in
 * `useActiveDesignStore`; this holds only what that document does not —
 * which garment it sits on, how it is to be decorated, and who it is for.
 *
 * Persisted rather than passed through the URL because the design it
 * accompanies is far too large to serialise into a query string, and
 * because both halves must survive the same refresh to stay consistent
 * with each other.
 */
export const useDesignOrderStore = create<DesignOrderState>()(
  persist(
    (set) => ({
      garmentProductId: null,
      decoration: emptyDecoration(),
      names: [],
      reachedQuantity: false,
      proofUrl: null,
      designProjectId: null,
      setGarment: (garmentProductId) => set({ garmentProductId }),
      setDecoration: (patch) =>
        set((prev) => ({ decoration: { ...prev.decoration, ...patch } })),
      setNames: (names) => set({ names }),
      setReachedQuantity: (reachedQuantity) => set({ reachedQuantity }),
      setProof: ({ proofUrl, designProjectId }) =>
        set({ proofUrl, designProjectId }),
      clear: () =>
        set({
          garmentProductId: null,
          decoration: emptyDecoration(),
          names: [],
          reachedQuantity: false,
          proofUrl: null,
          designProjectId: null,
        }),
    }),
    {
      name: "gwg-design-order",
      version: 1,
    },
  ),
);

/** Names/numbers only count as a team order once someone is actually
 *  named — a row the customer tabbed through and left blank is not a
 *  person, and must not turn a plain size+quantity order into a roster. */
export function namedRosterEntries(
  names: DesignRosterName[],
): DesignRosterName[] {
  return names.filter(
    (entry) => entry.name.trim() !== "" || entry.number.trim() !== "",
  );
}

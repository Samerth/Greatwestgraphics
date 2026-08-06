export type DesignSideProofs = {
  front?: string;
  back?: string;
  updatedAt: string;
};

const STORAGE_KEY = "gwg-design-proofs";

export function loadDesignProofs(): DesignSideProofs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DesignSideProofs;
  } catch {
    return null;
  }
}

export function saveDesignSideProof(
  side: "front" | "back",
  dataUrl: string
): DesignSideProofs {
  const current = loadDesignProofs() || { updatedAt: new Date().toISOString() };
  const next: DesignSideProofs = {
    ...current,
    [side]: dataUrl,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

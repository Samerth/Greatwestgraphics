import {
  DesignSides,
  isDurableArtworkSrc,
  type DesignDocument,
} from "@gwg/contracts";

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}

export async function dataUrlToBlob(src: string): Promise<Blob> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("Could not reopen the saved artwork preview.");
  }
  return response.blob();
}

export function filenameForArtworkBlob(blob: Blob): string {
  if (blob.type === "image/svg+xml") return "draft.svg";
  if (blob.type === "image/png") return "draft.png";
  return "draft.jpg";
}

/**
 * Browser `blob:` URLs die when the tab navigates — including the trip
 * through sign-in. Data URLs survive that hop in localStorage so the
 * canvas can come back after the customer confirms their account.
 */
export async function artworkSrcForDraft(blob: Blob): Promise<string> {
  return blobToDataUrl(blob);
}

export function draftHasEphemeralArtwork(design: DesignDocument): boolean {
  return DesignSides.some((side) =>
    design.artworksBySide[side].some((artwork) => !isDurableArtworkSrc(artwork.src)),
  );
}

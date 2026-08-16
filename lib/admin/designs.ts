import { normalizeDesignDocument, type DesignDocument } from "@gwg/contracts";

export type AdminDesignView = {
  id: string;
  /** The owning customer — staff uploads are filed under it so they can see them. */
  personId: string | null;
  name: string;
  garmentProductId: string | null;
  proofImageUrl: string | null;
  customerName: string | null;
  customerEmail: string | null;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  design: DesignDocument;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** `updated_by` holds an Actor, not a string, so read a name out of it. */
function actorName(value: unknown): string | null {
  if (!value || typeof value !== "object") return text(value);
  const actor = value as { displayName?: unknown; type?: unknown };
  return text(actor.displayName) ?? text(actor.type);
}

export function toAdminDesignView(
  row: Record<string, unknown>,
): AdminDesignView {
  return {
    id: String(row.id ?? ""),
    personId: text(row.personId),
    name: text(row.name) ?? "Untitled design",
    garmentProductId: text(row.garmentProductId),
    proofImageUrl: text(row.proofImageUrl),
    customerName: text(row.customerName),
    customerEmail: text(row.customerEmail),
    updatedBy: actorName(row.updatedBy),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt),
    // The API already sends a normalized document. Running it through again
    // costs nothing and means a row read by any other path still reaches the
    // previews in one shape, with the raw columns as the last resort.
    design: normalizeDesignDocument(row.design ?? row),
  };
}

export function formatDesignTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

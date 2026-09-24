import {
  DESIGN_SIDE_LABELS,
  DesignSides,
  type JobRequestDetailResponse,
  type JobRequestStatus,
} from "@gwg/contracts";
import { jobStatusPresentation, type StatusTone } from "@/lib/commerce/status";
import { portalDecorations } from "@/lib/commerce/portal-progress";
import type { PortalDecoration } from "@/lib/commerce/portal-progress";
import { designSnapshotFromConfiguration } from "@/lib/commerce/design-line-snapshot";
import { getAuthoritativeLineTotalMinor } from "@/lib/utils/quote-pricing";
import {
  formatSizeBreakdown,
  groupAdminJobLines,
  placementKey,
  productKeyFromStorefrontId,
  withoutSizeSegment,
} from "@/lib/admin/job-lines";
import { jobPipelineState, staffNextStatuses, type JobPipelineState } from "@/lib/admin/job-pipeline";
import { summarizeJobMoney, type JobMoney } from "@/lib/admin/job-money";
import { summarizeJobInventory, type GroupStock, type JobStock } from "@/lib/admin/job-inventory";
import { summarizeJobProofs, type ProofStateInfo } from "@/lib/admin/job-proof-status";

export function safeProofUrl(storageKey: string): string | null {
  if (storageKey.startsWith("/")) return storageKey;
  try {
    const url = new URL(storageKey);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

type LineConfiguration = {
  color?: string;
  size?: string;
  image?: string;
  storefrontProductId?: string;
  productMetadata?: string;
  designProjectId?: string;
  artworkProofUrl?: string;
  designNotes?: string;
  roster?: { size: string; name: string; number?: string }[];
  pricingUnverified?: boolean;
  pricing?: unknown;
  designSnapshot?: unknown;
  garmentPhotos?: { styleName?: string | null; styleTitle?: string | null; colorFrontImageUrl?: string | null };
};

export interface JobFile {
  label: string;
  href: string;
  download?: string;
}

export interface ProductLineView {
  key: string;
  description: string;
  color: string | null;
  quantity: number;
  unitPriceEstimateMinor: number | null;
  totalMinor: number | null;
  sizes: { size: string; quantity: number }[];
  sizeBreakdown: string;
  pricingUnverified: boolean;
  decorations: PortalDecoration[];
  placementNote: string | null;
  catalogHint: string | null;
  styleName: string | null;
  styleTitle: string | null;
  artworkProofUrl: string | null;
  snapshot: ReturnType<typeof designSnapshotFromConfiguration>;
  designProjectId: string | null;
  designNotes: string | null;
  artworkLayers: {
    side: (typeof DesignSides)[number];
    index: number;
    id: string;
    src: string;
    label: string;
  }[];
  roster: { size: string; name: string; number?: string }[] | null;
  stock: GroupStock | null;
}

/** Every colour of one design, decorated the same way. Almost always
 *  exactly one per product — every colour of a design was decorated
 *  identically in the Design Studio — but the shape allows more than one
 *  where a product genuinely carries two. */
export interface AdminDecorationGroup {
  key: string;
  /** `placementNote` (or the product's own description as a last resort) —
   *  shown once for the whole decoration, not repeated per colour, since
   *  every colour inside it shares it. */
  label: string;
  colours: ProductLineView[];
  quantity: number;
  totalMinor: number | null;
}

/** One garment, however many colours it was ordered in. */
export interface AdminProductGroup {
  key: string;
  description: string;
  decorations: AdminDecorationGroup[];
  quantity: number;
  totalMinor: number | null;
}

/** Mirrors `groupAdminJobLines`'s own rule for combining a `totalMinor`
 *  that may be null on some lines: sum whatever real values exist, and
 *  land on `null` only when every one of them was null. */
function sumTotalMinor(values: readonly (number | null)[]): number | null {
  let sum: number | null = null;
  for (const value of values) {
    if (value == null) continue;
    sum = (sum ?? 0) + value;
  }
  return sum;
}

/**
 * Groups the already-built per-colour product lines into the tree Pavin
 * asked for once he saw the cart rebuilt this way: **Product → Decoration →
 * Colour → Sizes** (sizes already nested inside each `ProductLineView` via
 * `sizeBreakdown`). One card per garment regardless of how many colours it
 * was ordered in, instead of GWG-1034 reading as three near-identical
 * "Allmade Unisex Organic Cotton Tee" cards for Matcha Green, Deep Black and
 * Arctic Blue.
 *
 * Built on top of `products` — the same `ProductLineView[]` `buildJobView`
 * already produces via `groupAdminJobLines` — so the colour-and-size fold
 * itself, and everything that already reads it (stock, money, the files
 * list, every existing test), is untouched. This only adds two wrapping
 * levels above it, the same shape `groupCartItemsByProduct`
 * (`lib/commerce/cart-groups.ts`) already gives the cart.
 *
 * Keyed on `description` for the product level — the garment's plain name
 * (`storefrontProductName`, e.g. "Allmade Unisex Organic Cotton Tee"),
 * which is already shared byte-for-byte across every colour of one style
 * (it never includes a colour), unlike `productKey`/`storefrontProductId`,
 * which is a specific colourway's own catalogue row and therefore differs
 * per colour by construction.
 */
export function groupProductLinesByStyle(
  products: readonly ProductLineView[],
): AdminProductGroup[] {
  const byProduct = new Map<
    string,
    { description: string; decorations: Map<string, ProductLineView[]> }
  >();

  for (const line of products) {
    const pKey = line.description;
    const dKey = line.placementNote ?? line.description;

    let product = byProduct.get(pKey);
    if (!product) {
      product = { description: line.description, decorations: new Map() };
      byProduct.set(pKey, product);
    }

    const bucket = product.decorations.get(dKey);
    if (bucket) bucket.push(line);
    else product.decorations.set(dKey, [line]);
  }

  const result: AdminProductGroup[] = [];
  for (const [pKey, product] of byProduct) {
    const decorations: AdminDecorationGroup[] = [];
    for (const [dKey, colours] of product.decorations) {
      decorations.push({
        key: `${pKey}||${dKey}`,
        label: dKey,
        colours,
        quantity: colours.reduce((sum, c) => sum + c.quantity, 0),
        totalMinor: sumTotalMinor(colours.map((c) => c.totalMinor)),
      });
    }

    result.push({
      key: pKey,
      description: product.description,
      decorations,
      quantity: decorations.reduce((sum, d) => sum + d.quantity, 0),
      totalMinor: sumTotalMinor(decorations.map((d) => d.totalMinor)),
    });
  }

  return result;
}

export interface JobView {
  /** The raw job id — what every server action and API call actually
   *  addresses. `header.displayId` ("GWG-1034") is for people; this is for
   *  code. */
  id: string;
  customerPersonId: string;
  header: {
    displayId: string;
    storeName: string;
    status: JobRequestStatus;
    statusLabel: string;
    tone: StatusTone;
    customerName: string | null;
    company: string | null;
  };
  summary: {
    orderedAt: string;
    quantity: number;
    totalMinor: number;
    isRush: boolean;
    requestedDate: string | null;
    promisedDate: string | null;
    rushConfirmedAt: string | null;
    rushConfirmedByName: string | null;
    method: "pickup" | "shipping" | "unknown";
  };
  pipeline: JobPipelineState;
  nextStatuses: readonly JobRequestStatus[];
  contact: JobRequestDetailResponse["contact"];
  fulfillment: JobRequestDetailResponse["fulfillment"];
  products: ProductLineView[];
  /** `products`, grouped Product → Decoration → Colour for the page's own
   *  rendering (`groupProductLinesByStyle`). `products` itself stays flat —
   *  the files list and the tests that pin "one product per colour" both
   *  read that one, untouched. */
  productGroups: AdminProductGroup[];
  stock: JobStock;
  money: JobMoney;
  computedTotalMinor: number;
  proofs: { current: ProofStateInfo; versions: JobRequestDetailResponse["proofs"] };
  files: JobFile[];
  notes: {
    customer: string | null;
    internal: string | null;
    internalUpdatedAt: string | null;
    internalUpdatedByName: string | null;
    design: string[];
  };
  timeline: JobRequestDetailResponse["timeline"];
  invoiceRequestedAt: string | null;
  canTakePayment: boolean;
}

/**
 * Assembles everything the admin job page renders, out of one API response.
 * Nothing here talks to the network — that stays in `page.tsx`, which is
 * why this function can carry its own tests. Every section component takes
 * a narrow slice of the object this returns, never the raw `detail`, which
 * is what keeps `page.tsx` from growing back into an 800-line file: there
 * is nothing in scope for a section to reach past its own slice.
 */
export function buildJobView(
  detail: JobRequestDetailResponse,
  storeName: string | null,
): JobView {
  const presentation = jobStatusPresentation[detail.status];
  const orderedAt = detail.submittedAt ?? detail.createdAt;
  const isRush = detail.fulfillment?.turnaround?.kind === "rush";

  const linesById = new Map(detail.lines.map((line) => [line.id, line]));
  const configOf = (lineId: string): LineConfiguration =>
    (linesById.get(lineId)?.snapshot.configuration ?? {}) as LineConfiguration;

  const lineGroups = groupAdminJobLines(
    detail.lines.map((line) => {
      const config = line.snapshot.configuration as LineConfiguration;
      return {
        id: line.id,
        description: line.snapshot.description,
        quantity: line.snapshot.quantity,
        color: config.color ?? null,
        size: config.size ?? null,
        productKey: productKeyFromStorefrontId(config.storefrontProductId),
        placement: placementKey(config),
        unitPriceEstimateMinor: line.snapshot.unitPriceEstimateMinor ?? null,
        totalMinor: getAuthoritativeLineTotalMinor(line.snapshot) ?? null,
      };
    }),
  );

  const orderQuantity = lineGroups.reduce((sum, g) => sum + g.quantity, 0);
  const orderTotalMinor = lineGroups.reduce((sum, g) => sum + (g.totalMinor ?? 0), 0);

  const stock = summarizeJobInventory(
    lineGroups,
    detail.lines.map((line) => ({
      id: line.id,
      size: (line.snapshot.configuration as LineConfiguration).size ?? null,
    })),
    detail.inventory?.lines ?? null,
  );

  const money = summarizeJobMoney(
    detail.lines.map((line) => line.snapshot),
    (detail.finalQuotes ?? []).map((q) => ({
      version: q.version,
      amountMinor: q.amountMinor,
      note: q.note ?? null,
      acceptedAt: q.acceptedAt ?? null,
    })),
    isRush,
  );

  const proofsSummary = summarizeJobProofs(detail.proofs ?? []);

  const products: ProductLineView[] = lineGroups.map((group) => {
    const configuration = configOf(group.ids[0]!);
    const snapshot = designSnapshotFromConfiguration(configuration);
    const artworkLayers = snapshot
      ? DesignSides.flatMap((side) =>
          snapshot.design.artworksBySide[side].map((artwork, index) => ({
            side,
            index,
            id: artwork.id,
            src: artwork.src,
            label: `${DESIGN_SIDE_LABELS[side]} · ${snapshot.design.placementBySide[side]}`,
          })),
        )
      : [];
    const catalogHintRaw = configuration.productMetadata || configuration.storefrontProductId || null;
    return {
      key: group.key,
      description: group.description,
      color: group.color,
      quantity: group.quantity,
      unitPriceEstimateMinor: group.unitPriceEstimateMinor,
      totalMinor: group.totalMinor,
      sizes: group.sizes,
      sizeBreakdown: formatSizeBreakdown(group.sizes),
      pricingUnverified: Boolean(configuration.pricingUnverified),
      decorations: portalDecorations(configuration?.pricing),
      placementNote: withoutSizeSegment(configuration?.productMetadata),
      catalogHint: catalogHintRaw !== configuration.productMetadata ? catalogHintRaw : null,
      styleName: configuration.garmentPhotos?.styleName ?? null,
      styleTitle: configuration.garmentPhotos?.styleTitle ?? null,
      artworkProofUrl: configuration.artworkProofUrl ?? null,
      snapshot,
      designProjectId: configuration.designProjectId ?? null,
      designNotes: configuration.designNotes?.trim() || null,
      artworkLayers,
      roster: configuration.roster && configuration.roster.length > 0 ? configuration.roster : null,
      stock: stock.byGroup[group.key] ?? null,
    };
  });

  const files: JobFile[] = [];
  for (const product of products) {
    for (const layer of product.artworkLayers) {
      files.push({ label: `${product.description} — ${layer.label}`, href: layer.src, download: `${layer.side}-artwork` });
    }
    if (product.artworkProofUrl) {
      files.push({ label: `${product.description} — mockup`, href: product.artworkProofUrl });
    }
    if (product.designProjectId) {
      files.push({ label: `${product.description} — open in Design Studio`, href: `/admin/designs/${product.designProjectId}/edit` });
    }
  }
  for (const proof of proofsSummary.versions) {
    const url = safeProofUrl(proof.storageKey);
    if (url) files.push({ label: `Proof v${proof.version}`, href: url });
  }

  const designNotes = products.map((p) => p.designNotes).filter((n): n is string => Boolean(n));

  return {
    id: detail.id,
    customerPersonId: detail.customerPersonId,
    header: {
      displayId: detail.displayId,
      storeName: storeName ?? "Main store",
      status: detail.status,
      statusLabel: presentation.label,
      tone: presentation.tone,
      customerName: detail.contact?.fullName ?? null,
      company: detail.contact?.company ?? null,
    },
    summary: {
      orderedAt,
      quantity: orderQuantity,
      totalMinor: orderTotalMinor,
      isRush,
      requestedDate: detail.fulfillment?.turnaround?.requestedDate ?? null,
      promisedDate: detail.promisedDate ?? null,
      rushConfirmedAt: detail.rushConfirmedAt ?? null,
      rushConfirmedByName: detail.rushConfirmedBy?.displayName ?? null,
      method: !detail.fulfillment
        ? "unknown"
        : detail.fulfillment.method === "pickup"
          ? "pickup"
          : "shipping",
    },
    pipeline: jobPipelineState({
      status: detail.status,
      awaitingCustomerProof: proofsSummary.current.state === "sent",
      proofApproved: proofsSummary.current.state === "approved",
    }),
    nextStatuses: staffNextStatuses(detail.status, detail.fulfillment?.method),
    contact: detail.contact,
    fulfillment: detail.fulfillment,
    products,
    productGroups: groupProductLinesByStyle(products),
    stock,
    money,
    computedTotalMinor: orderTotalMinor,
    proofs: { current: proofsSummary.current, versions: proofsSummary.versions },
    files,
    notes: {
      customer: detail.customerNote ?? null,
      internal: detail.internalNote ?? null,
      internalUpdatedAt: detail.internalNoteUpdatedAt ?? null,
      internalUpdatedByName: detail.internalNoteUpdatedBy?.displayName ?? null,
      design: designNotes,
    },
    timeline: detail.timeline,
    invoiceRequestedAt: detail.invoiceRequestedAt ?? null,
    canTakePayment:
      detail.status === "awaiting_payment" ||
      detail.status === "payment_pending" ||
      detail.status === "payment_failed",
  };
}

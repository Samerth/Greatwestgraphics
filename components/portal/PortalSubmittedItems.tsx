import { ButtonLink } from "@/components/shared/Button";
import { RosterTable, type RosterEntry } from "@/components/shared/RosterTable";
import { money, getAuthoritativeLineTotalMinor } from "@/lib/utils/quote-pricing";
// The grouping lives under lib/admin only because staff needed it first
// (Pavin, 10 Sep). The logic is about job lines, not about the admin, and the
// customer's own summary has exactly the same problem to solve.
import {
  groupAdminJobLines,
  groupAdminLineGroupsByProduct,
  formatSizeBreakdown,
} from "@/lib/admin/job-lines";
import { portalDecorations } from "@/lib/commerce/portal-progress";
import { designSnapshotFromConfiguration } from "@/lib/commerce/design-line-snapshot";
import { DesignLineThumbnail } from "@/components/design/DesignLineThumbnail";

type LineSnapshot = {
  description: string;
  quantity: number;
  unitPriceEstimateMinor?: number;
  configuration: Record<string, unknown>;
};

export type PortalLine = { id: string; snapshot: LineSnapshot };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * What the customer ordered, shown so they can actually check it
 * (CodSphere UAT V2 row 55, point 3).
 *
 * An order is stored one line per size, so rendering it raw gives a
 * 100-piece order across five sizes as five near-identical blocks. They are
 * folded into **Product → Decoration → Colour → Sizes**, the same tree the
 * cart and the admin job page use — one card per garment regardless of how
 * many colours it was ordered in, a decoration note shown once rather than
 * repeated per colour, and each colour still carrying its own thumbnail
 * (redrawn on its own garment photo, not one shared picture).
 */
export function PortalSubmittedItems({
  lines,
  customerNote,
}: {
  lines: readonly PortalLine[];
  customerNote?: string | null;
}) {
  const groups = groupAdminJobLines(
    lines.map((line) => ({
      id: line.id,
      description: line.snapshot.description,
      quantity: line.snapshot.quantity,
      color: text(line.snapshot.configuration.color),
      size: text(line.snapshot.configuration.size),
      productKey: text(line.snapshot.configuration.storefrontProductId),
      placement: text(line.snapshot.configuration.productMetadata),
      unitPriceEstimateMinor: line.snapshot.unitPriceEstimateMinor ?? null,
      totalMinor:
        getAuthoritativeLineTotalMinor(line.snapshot as never) ??
        (line.snapshot.unitPriceEstimateMinor != null
          ? line.snapshot.unitPriceEstimateMinor * line.snapshot.quantity
          : null),
    })),
  );

  // Grouping folds several originals into one row, so anything rendered off a
  // single line (image, artwork, roster) is taken from the first of them.
  const byId = new Map(lines.map((line) => [line.id, line]));
  const products = groupAdminLineGroupsByProduct(groups);

  return (
    <div data-portal="submitted-items" className="space-y-sp-4">
      {products.map((product) => (
        <article
          key={product.key}
          className="border border-border rounded-md overflow-hidden bg-bg-raised"
        >
          <div className="flex flex-wrap justify-between gap-2 px-sp-3 py-sp-2 border-b border-border bg-fill-subtle-15">
            <b className="text-[15px]">{product.description}</b>
            {product.totalMinor != null && (
              <span className="text-sm whitespace-nowrap">
                <b>{money(product.totalMinor / 100)}</b>
              </span>
            )}
          </div>

          {product.decorations.map((decoration) => {
            // Every colour in one decoration was decorated identically in
            // the Design Studio, so the shared facts below (what it's
            // decorated with, the artwork, any team roster) come off just
            // the first colour rather than repeating an identical block
            // per colour.
            const rep = decoration.colours[0]!;
            const repLine = byId.get(rep.ids[0]!);
            const repConfig = repLine?.snapshot.configuration ?? {};
            const artworkProofUrl = text(repConfig.artworkProofUrl);
            const designProjectId = text(repConfig.designProjectId);
            const designNotes = text(repConfig.designNotes);
            const roster = repConfig.roster as RosterEntry[] | undefined;
            const decorationsList = portalDecorations(repConfig.pricing);

            return (
              <div
                key={decoration.key}
                className="px-sp-3 py-sp-2 border-b border-border last:border-b-0"
              >
                {decorationsList.length > 0 && (
                  <div className="mb-sp-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                      Decoration
                    </p>
                    <ul className="m-0 list-none p-0 space-y-1">
                      {decorationsList.map((d) => (
                        <li
                          key={`${d.method}-${d.location}`}
                          className="text-sm text-text-secondary"
                        >
                          <b className="text-text-primary">{d.method}</b>
                          {" — "}
                          {d.location}
                          {d.detail ? ` · ${d.detail}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* The placement string the studio wrote at add-to-cart
                    time, kept as a fallback for lines whose snapshot
                    predates the pricing decorations above. Only shown when
                    it is a real note — `decoration.label` falls back to the
                    product's own description when there isn't one, and
                    repeating that right under the product name would just
                    be noise. */}
                {decorationsList.length === 0 &&
                decoration.label &&
                decoration.label !== product.description ? (
                  <p className="text-sm text-text-secondary mb-sp-2">
                    {decoration.label}
                  </p>
                ) : null}

                {(artworkProofUrl || designProjectId) && (
                  <div className="mb-sp-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                      Artwork you sent
                    </p>
                    {artworkProofUrl && (
                      <a href={artworkProofUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={artworkProofUrl}
                          alt={`Artwork for ${product.description}`}
                          className="h-28 w-auto border border-border rounded-sm bg-white"
                        />
                      </a>
                    )}
                    {designProjectId && (
                      <div className={artworkProofUrl ? "mt-2" : undefined}>
                        <ButtonLink
                          href={`/design?loadDesignId=${encodeURIComponent(designProjectId)}`}
                          variant="secondary"
                          size="sm"
                        >
                          Reopen in the studio
                        </ButtonLink>
                      </div>
                    )}
                  </div>
                )}

                {designNotes && (
                  <p className="text-sm text-text-secondary mb-sp-2 whitespace-pre-wrap">
                    Your instructions: {designNotes}
                  </p>
                )}

                {roster && roster.length > 0 && (
                  <div className="mb-sp-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                      Team roster submitted
                    </p>
                    <RosterTable roster={roster} />
                  </div>
                )}

                <div className="space-y-2">
                  {decoration.colours.map((group) => {
                    const first = byId.get(group.ids[0]!);
                    const config = first?.snapshot.configuration ?? {};
                    const image = text(config.image);
                    // A frozen copy of the design's own layout, drawn on
                    // this colour's own garment photo — null on any order
                    // placed before this existed (falls back to `image`
                    // below, exactly as it always has).
                    const snapshot = designSnapshotFromConfiguration(config);

                    return (
                      <div
                        key={group.key}
                        className="flex gap-sp-3 rounded-md border border-border p-sp-2"
                      >
                        {snapshot || image ? (
                          <DesignLineThumbnail
                            design={snapshot?.design}
                            garmentPhotos={snapshot?.garmentPhotos}
                            className="relative h-16 w-16 shrink-0 rounded-sm border border-border bg-white overflow-hidden"
                            fallback={
                              image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={image}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-contain"
                                />
                              ) : null
                            }
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="text-sm font-bold">{group.color}</span>
                            {group.totalMinor != null && (
                              <span className="text-sm whitespace-nowrap">
                                <b>{money(group.totalMinor / 100)}</b>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-secondary mt-0.5 mb-0">
                            Qty {group.quantity.toLocaleString("en-CA")}
                            {group.unitPriceEstimateMinor != null
                              ? ` · ${money(group.unitPriceEstimateMinor / 100)} each`
                              : ""}
                          </p>
                          {group.sizes.length > 0 && (
                            <p
                              data-portal="size-breakdown"
                              className="text-sm text-text-secondary mt-0.5 mb-0 tabular-nums"
                            >
                              {formatSizeBreakdown(group.sizes)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </article>
      ))}

      {customerNote && (
        <div className="border border-border rounded-md p-sp-3">
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
            Your note to us
          </p>
          <p className="text-sm text-text-secondary m-0 whitespace-pre-wrap">
            {customerNote}
          </p>
        </div>
      )}
    </div>
  );
}

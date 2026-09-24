import Link from "next/link";
import type { AdminProductGroup } from "@/lib/admin/job-view";
import { DesignLineThumbnail } from "@/components/design/DesignLineThumbnail";
import { ArtworkFileSize } from "@/components/admin/ArtworkFileSize";
import { RosterTable } from "@/components/shared/RosterTable";
import { Badge } from "@/components/ui/Badge";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

/**
 * The client's point 4, rebuilding the Lines section — now nested
 * **Product → Decoration → Colour → Sizes**, the same tree the cart uses
 * (Pavin, once he saw both: "Yeah they should look similar... Product and
 * design / Color then size"). One card per garment regardless of how many
 * colours it was ordered in — GWG-1034 used to read as three near-identical
 * "Allmade Unisex Organic Cotton Tee" cards for Matcha Green, Deep Black
 * and Arctic Blue; it is now one card, one decoration heading, three colour
 * rows.
 *
 * The decoration facts (method/placement, uploaded artwork, roster, the
 * "open in studio" link) are shown once per decoration rather than repeated
 * on every colour, since every colour inside one decoration was decorated
 * identically in the Design Studio. Each colour still carries its own
 * thumbnail, redrawn on its own garment photo — collapsing to one image for
 * the whole product would have reintroduced the "cart showing the wrong
 * colour" bug this same session already fixed once.
 */
export function ProductGroupCard({ product }: { product: AdminProductGroup }) {
  return (
    <article className="border border-border rounded-md overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-sp-3 py-sp-2 border-b border-border bg-fill-subtle-15">
        <div className="min-w-0">
          <p className="font-semibold m-0">{product.description}</p>
          <p className="text-xs text-text-tertiary mt-0.5 mb-0">
            {product.quantity.toLocaleString("en-CA")}{" "}
            {product.quantity === 1 ? "piece" : "pieces"}
          </p>
        </div>
        {product.totalMinor != null && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-bold">
              Product total
            </div>
            <div className="font-bold text-sm tabular-nums">
              {moneyFromMinor(product.totalMinor)}
            </div>
          </div>
        )}
      </div>

      {product.decorations.map((decoration) => {
        // Every colour in one decoration shares the same design — frozen
        // once per addToCart() call in the studio — so it's safe to read
        // the decoration-level facts (method, artwork, roster) off just the
        // first colour rather than repeating an identical block per colour.
        const rep = decoration.colours[0]!;
        return (
          <div
            key={decoration.key}
            className="px-sp-3 py-sp-2 border-b border-border last:border-b-0"
          >
            {product.decorations.length > 1 && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary mt-0 mb-sp-1">
                {decoration.label}
              </p>
            )}

            {rep.pricingUnverified && (
              <p className="text-xs font-semibold text-amber-700 mt-0 mb-1">
                Customer-side estimate — not re-priced by the pricing engine. Confirm this
                line before quoting.
              </p>
            )}

            {rep.decorations.length > 0 && (
              <ul
                data-admin="decoration-lines"
                className="m-0 mb-1.5 list-none p-0 space-y-0.5 text-sm"
              >
                {rep.decorations.map((d) => (
                  <li key={`${d.location}-${d.method}`}>
                    <span className="font-bold">{d.location}: </span>
                    {d.method}
                    {d.detail ? ` · ${d.detail}` : ""}
                  </li>
                ))}
              </ul>
            )}

            {rep.placementNote && (
              <p className="text-sm text-text-primary mt-0 mb-1.5">
                <span className="font-bold">Print placement. </span>
                {rep.placementNote}
              </p>
            )}

            {(rep.artworkProofUrl || rep.designProjectId) && (
              <div className="flex flex-wrap items-center gap-3 mb-1.5">
                {rep.designProjectId && (
                  <Link
                    href={`/admin/designs/${rep.designProjectId}/edit`}
                    className="text-sm underline"
                  >
                    Open this design in the studio
                  </Link>
                )}
              </div>
            )}

            {rep.artworkLayers.length > 0 && (
              <details className="mb-1.5">
                <summary className="text-sm cursor-pointer">
                  Original artwork files · {rep.artworkLayers.length} file
                  {rep.artworkLayers.length === 1 ? "" : "s"}
                </summary>
                <ul className="m-0 mt-2 p-0 list-none border border-border rounded-md divide-y divide-border">
                  {rep.artworkLayers.map((layer) => (
                    <li
                      key={layer.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-sp-2"
                    >
                      <div>
                        <p className="font-bold text-sm m-0">{layer.label}</p>
                        <p className="text-xs text-text-tertiary m-0 mt-1">
                          <ArtworkFileSize src={layer.src} />
                        </p>
                      </div>
                      <a
                        href={layer.src}
                        download={`${layer.side}-artwork-${layer.index + 1}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-bold text-accent"
                      >
                        Download original
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {rep.roster && (
              <details className="mb-1.5">
                <summary className="text-sm cursor-pointer">
                  Roster · {rep.roster.length} name{rep.roster.length === 1 ? "" : "s"}
                </summary>
                <div className="mt-2">
                  <RosterTable roster={rep.roster} />
                </div>
              </details>
            )}

            <div className="space-y-1.5 mt-sp-1">
              {decoration.colours.map((colour) => (
                <div
                  key={colour.key}
                  className="flex items-center gap-3 rounded-md border border-border p-sp-2"
                >
                  <DesignLineThumbnail
                    design={colour.snapshot?.design}
                    garmentPhotos={colour.snapshot?.garmentPhotos}
                    className="relative h-14 w-14 shrink-0 border border-border rounded-sm bg-white overflow-hidden"
                    fallback={
                      colour.artworkProofUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={colour.artworkProofUrl}
                          alt={`${product.description} — ${colour.color ?? ""}`}
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      ) : null
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold m-0">{colour.color}</p>
                      {colour.stock && colour.stock.state !== "ok" && (
                        <Badge
                          size="sm"
                          tone={colour.stock.state === "short" ? "warning" : "neutral"}
                        >
                          {colour.stock.state === "short"
                            ? `short ${colour.stock.shortfallUnits}`
                            : "stock unknown"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5 mb-0">
                      Qty {colour.quantity.toLocaleString("en-CA")}
                      {colour.unitPriceEstimateMinor != null
                        ? ` · est. ${moneyFromMinor(colour.unitPriceEstimateMinor)} / unit`
                        : ""}
                      {colour.totalMinor != null
                        ? ` · total ${moneyFromMinor(colour.totalMinor)}`
                        : ""}
                    </p>
                    {colour.sizes.length > 0 && (
                      <p className="text-sm font-semibold text-text-primary mt-0.5 mb-0 tabular-nums">
                        {colour.sizeBreakdown}
                      </p>
                    )}
                    {colour.catalogHint && (
                      <p className="text-xs text-text-tertiary mt-0.5 mb-0">
                        {colour.catalogHint}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </article>
  );
}

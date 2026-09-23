import Link from "next/link";
import type { ProductLineView } from "@/lib/admin/job-view";
import { DesignLineThumbnail } from "@/components/design/DesignLineThumbnail";
import { ArtworkFileSize } from "@/components/admin/ArtworkFileSize";
import { RosterTable } from "@/components/shared/RosterTable";
import { Badge } from "@/components/ui/Badge";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

/** The client's point 4, rebuilding the Lines section: product name,
 *  style/SKU, colour, full size breakdown and photo; per decoration,
 *  method/placement/colour count/size, the uploaded artwork and the
 *  mockup. Every decorated location shows as its own line — read straight
 *  off `portalDecorations(configuration?.pricing)`, the same source the
 *  customer portal reads, wrapped in `data-admin="decoration-lines"` (see
 *  lib/admin/job-lines.test.ts). */
export function ProductLineCard({ product }: { product: ProductLineView }) {
  const { snapshot } = product;
  return (
    <article className="border border-border rounded-md p-sp-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold m-0">{product.description}</p>
          {(product.styleName || product.styleTitle) && (
            <p className="text-xs text-text-tertiary mt-0.5 mb-0">
              {[product.styleTitle, product.styleName].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="text-sm text-text-secondary mt-1 mb-0">
            {product.color ? `${product.color} · ` : ""}
            Qty {product.quantity.toLocaleString("en-CA")}
            {product.unitPriceEstimateMinor != null
              ? ` · est. ${moneyFromMinor(product.unitPriceEstimateMinor)} / unit`
              : ""}
            {product.totalMinor != null ? ` · total ${moneyFromMinor(product.totalMinor)}` : ""}
          </p>
          {product.sizes.length > 0 && (
            <p className="text-sm font-semibold text-text-primary mt-1 mb-0 tabular-nums">
              {product.sizeBreakdown}
            </p>
          )}
        </div>
        {product.stock && product.stock.state !== "ok" && (
          <Badge
            size="sm"
            tone={product.stock.state === "short" ? "warning" : "neutral"}
          >
            {product.stock.state === "short"
              ? `short ${product.stock.shortfallUnits}`
              : "stock unknown"}
          </Badge>
        )}
      </div>

      {product.pricingUnverified && (
        <p className="text-xs font-semibold text-amber-700 mt-1 mb-0">
          Customer-side estimate — not re-priced by the pricing engine. Confirm this line before
          quoting.
        </p>
      )}

      {product.decorations.length > 0 && (
        <ul
          data-admin="decoration-lines"
          className="m-0 mt-2 list-none p-0 space-y-0.5 text-sm"
        >
          {product.decorations.map((decoration) => (
            <li key={`${decoration.location}-${decoration.method}`}>
              <span className="font-bold">{decoration.location}: </span>
              {decoration.method}
              {decoration.detail ? ` · ${decoration.detail}` : ""}
            </li>
          ))}
        </ul>
      )}

      {product.placementNote && (
        <p className="text-sm text-text-primary mt-2 mb-0">
          <span className="font-bold">Print placement. </span>
          {product.placementNote}
        </p>
      )}
      {product.catalogHint && (
        <p className="text-xs text-text-tertiary mt-1 mb-0">{product.catalogHint}</p>
      )}

      {(product.artworkProofUrl || product.designProjectId) && (
        <div className="flex flex-wrap items-start gap-3 mt-3">
          {snapshot ? (
            <DesignLineThumbnail
              design={snapshot.design}
              garmentPhotos={snapshot.garmentPhotos}
              className="relative h-24 w-24 border border-border rounded-sm bg-white overflow-hidden"
              fallback={
                product.artworkProofUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.artworkProofUrl}
                    alt={`Artwork proof for ${product.description}`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : null
              }
            />
          ) : (
            product.artworkProofUrl && (
              <a href={product.artworkProofUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.artworkProofUrl}
                  alt={`Artwork proof for ${product.description}`}
                  className="h-24 w-auto border border-border rounded-sm bg-white"
                />
              </a>
            )
          )}
          {product.designProjectId && (
            <Link href={`/admin/designs/${product.designProjectId}/edit`} className="text-sm underline">
              Open this design in the studio
            </Link>
          )}
        </div>
      )}

      {product.artworkLayers.length > 0 && (
        <details className="mt-3">
          <summary className="text-sm cursor-pointer">
            Original artwork files · {product.artworkLayers.length} file
            {product.artworkLayers.length === 1 ? "" : "s"}
          </summary>
          <ul className="m-0 mt-2 p-0 list-none border border-border rounded-md divide-y divide-border">
            {product.artworkLayers.map((layer) => (
              <li key={layer.id} className="flex flex-wrap items-center justify-between gap-3 p-sp-2">
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

      {product.roster && (
        <details className="mt-3">
          <summary className="text-sm cursor-pointer">
            Roster · {product.roster.length} name{product.roster.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-2">
            <RosterTable roster={product.roster} />
          </div>
        </details>
      )}
    </article>
  );
}

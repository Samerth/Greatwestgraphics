import type { JobStock } from "@/lib/admin/job-inventory";
import { Badge } from "@/components/ui/Badge";

/** The client's point 5: keep the live inventory check, but make the
 *  headline answer obvious — "can this whole order be filled?" — with the
 *  affected sizes only a click away, not read off a flat list. */
export function InventorySummary({ stock }: { stock: JobStock }) {
  const groups = Object.values(stock.byGroup).filter((g) => g.variants.length > 0);
  if (groups.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge tone={stock.state === "ok" ? "success" : stock.state === "short" ? "warning" : "neutral"}>
          {stock.summary}
        </Badge>
      </div>
      <details open={stock.state !== "ok"}>
        <summary className="text-sm cursor-pointer text-text-secondary">
          {stock.state === "ok" ? "Show details" : "Show affected sizes"}
        </summary>
        <ul className="m-0 mt-2 p-0 list-none space-y-1.5">
          {groups.flatMap((group) =>
            group.variants.map((variant) => (
              <li
                key={`${group.groupKey}-${variant.size ?? variant.sku}`}
                className={`text-sm ${variant.state === "short" ? "text-amber-800" : "text-text-secondary"}`}
              >
                <span className="font-semibold text-text-primary">
                  {variant.size ?? "—"}
                </span>
                {variant.sku ? ` · ${variant.sku}` : ""}
                {" — "}
                {variant.state === "unknown"
                  ? `requested ${variant.requested}; no catalogue quantity on file`
                  : `${variant.requested} requested, ${variant.available} in stock`}
                {variant.state === "short" ? ` · short ${variant.shortfall}` : ""}
              </li>
            )),
          )}
        </ul>
      </details>
    </div>
  );
}

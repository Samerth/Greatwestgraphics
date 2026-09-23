import type { JobView } from "@/lib/admin/job-view";
import { StatTile } from "@/components/ui/StatTile";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { formatPortalDate } from "@/lib/commerce/portal-progress";
import { formatRequestedDate } from "@/lib/schemas/checkout";

/** The client's point 1: "the most important information should be
 *  visible without scrolling." Nine facts, one glance — job #, who it's
 *  for, when it came in, how big it is, what it's worth, how it ships, and
 *  where it stands. */
export function OrderSummaryCard({ view }: { view: JobView }) {
  const { header, summary } = view;
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
      <StatTile label="Job #" value={header.displayId} />
      <StatTile
        label="Customer"
        value={header.customerName ?? "—"}
        hint={header.company ?? undefined}
        wide
      />
      <StatTile label="Order date" value={formatPortalDate(summary.orderedAt)} />
      <StatTile label="Total quantity" value={summary.quantity.toLocaleString("en-CA")} />
      <StatTile
        label="Order total"
        value={summary.totalMinor > 0 ? moneyFromMinor(summary.totalMinor) : "—"}
      />
      <StatTile
        label="Method"
        value={summary.isRush ? "Rush" : "Standard"}
        tone={summary.isRush ? "warning" : undefined}
      />
      <StatTile
        label="Requested date"
        value={summary.requestedDate ? formatRequestedDate(summary.requestedDate) : "—"}
      />
      <StatTile
        label="Fulfilment"
        value={
          summary.method === "pickup"
            ? "Pickup"
            : summary.method === "shipping"
              ? "Shipping"
              : "—"
        }
      />
      <StatTile label="Status" value={header.statusLabel} tone={header.tone} />
    </div>
  );
}

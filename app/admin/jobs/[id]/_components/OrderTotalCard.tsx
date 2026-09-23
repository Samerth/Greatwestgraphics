import type { JobMoney } from "@/lib/admin/job-money";
import { MoneyRow } from "@/components/ui/Money";
import { createFinalQuoteAction } from "@/app/admin/actions";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { formatPortalDateTime } from "@/lib/commerce/portal-progress";

/** The client's point 7: a real breakdown, not one opaque figure — built
 *  from the pricing detail already saved on every line (see
 *  `summarizeJobMoney`). Shipping and tax are shown as "confirmed on the
 *  invoice" rather than a number, since neither is persisted anywhere yet
 *  and PST applicability is still an open question with the accountant. */
export function OrderTotalCard({ jobId, money }: { jobId: string; money: JobMoney }) {
  return (
    <div className="space-y-3">
      {!money.reconciles && (
        <p className="text-xs text-text-tertiary m-0">
          A per-component breakdown is not available for this order — showing the total only.
        </p>
      )}
      <div>
        {money.rows.map((row) => (
          <MoneyRow
            key={row.key}
            label={row.label}
            amountMinor={row.amountMinor}
            note={row.note}
            emphasis={
              row.key === "subtotal" ? "subtotal" : row.key === "order-total" ? "total" : "none"
            }
          />
        ))}
      </div>

      {money.finalQuote ? (
        <div className="border-t border-border pt-2">
          <p className="text-sm font-bold m-0">
            Final quote v{money.finalQuote.version}: {moneyFromMinor(money.finalQuote.amountMinor)}
          </p>
          <p className="text-xs text-text-secondary m-0 mt-0.5">
            {money.finalQuote.acceptedAt
              ? `Accepted ${formatPortalDateTime(money.finalQuote.acceptedAt)}`
              : "Awaiting customer acceptance"}
          </p>
          {money.finalQuote.note && (
            <p className="text-xs text-text-secondary m-0 mt-0.5">{money.finalQuote.note}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-secondary m-0">No final quote yet.</p>
      )}

      <form action={createFinalQuoteAction} className="space-y-2 border-t border-border pt-3">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="computedTotalMinor" value={money.orderTotalMinor} />
        <label className="block text-sm font-semibold">
          Amount (CAD)
          <input
            name="amountDollars"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={
              money.orderTotalMinor > 0 ? (money.orderTotalMinor / 100).toFixed(2) : undefined
            }
            className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
          />
        </label>
        {money.orderTotalMinor > 0 && (
          <p className="text-xs text-text-secondary m-0">
            Line items total {moneyFromMinor(money.orderTotalMinor)}. Change the amount if
            you&apos;re adjusting — anything more than 10% away needs the override box below.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirmOverride" value="1" />
          I&apos;m deliberately quoting a different amount than the line total
        </label>
        <label className="block text-sm font-semibold">
          Note
          <input name="note" className="block mt-1 w-full border border-border rounded-sm px-2 py-1" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="markAwaitingPayment" value="1" />
          Approve job and open quote for customer acceptance
        </label>
        <button type="submit" className="bg-accent text-white font-bold px-4 py-2 rounded-sm">
          Issue final quote
        </button>
      </form>
    </div>
  );
}

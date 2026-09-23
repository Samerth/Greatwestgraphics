import type { CartItem } from "@/lib/store/cart";
import { computeCartTotals, PRICE_TO_BE_CONFIRMED_LABEL } from "@/lib/store/cart";
import { money } from "@/lib/utils/quote-pricing";
import type { DeliveryKey } from "@/lib/schemas/checkout";
import {
  RUSH_FEE_LABEL,
  formatRequestedDate,
  shippingStateFor,
} from "@/lib/schemas/checkout";
import type { TurnaroundSelection } from "./TurnaroundStep";
import { RosterTable } from "@/components/shared/RosterTable";

export function CheckoutSummary({
  items,
  deliveryKey,
  turnaround,
}: {
  items: CartItem[];
  deliveryKey: DeliveryKey;
  turnaround?: TurnaroundSelection;
}) {
  // Nothing is added to the estimate for delivery any more. Shipping is
  // either free or not yet known, and a rush fee is never calculated here
  // (rows 49 and 50) — so the totals are the goods plus tax, full stop.
  const t = computeCartTotals(items);
  const shipping = shippingStateFor(deliveryKey, t.netSubtotal);
  const isRush = turnaround?.kind === "rush";

  return (
    <div className="border border-border rounded-lg p-sp-4 bg-bg-raised">
      <h2 className="font-display font-bold mb-1">Your Request Summary</h2>
      <div className="text-[13px] text-text-tertiary mb-sp-3">{t.pieces} pieces</div>

      <div className="space-y-1 mb-sp-3">
        {items.map((item) => (
          <div
            key={`${item.id}-${item.color}`}
            className="text-sm border-b border-fill-subtle py-2"
          >
            <div className="flex justify-between">
              <span>
                {item.name}
                <br />
                <span className="text-[12.5px] text-text-tertiary">
                  ×{item.qty} pieces{item.roster ? " · team order" : ""}
                </span>
              </span>
              <b className={item.priceUnavailable ? "font-normal text-text-tertiary" : undefined}>
                {item.priceUnavailable
                  ? PRICE_TO_BE_CONFIRMED_LABEL
                  : money(item.qty * item.unit)}
              </b>
            </div>
            {/* Always visible, not tucked behind a click: this is who each
                shirt in the order actually goes to, confirmed here right
                before submission — not something a customer should have to
                go looking for. */}
            {item.roster && (
              <div className="mt-1.5">
                <span className="block text-[12px] font-bold text-text-secondary mb-1">
                  Names &amp; numbers on this order
                </span>
                <RosterTable roster={item.roster} />
              </div>
            )}
          </div>
        ))}
      </div>

      <Row label="Subtotal" value={money(t.subtotal)} />
      {t.discount > 0 && (
        <Row label="Volume tier discount" value={`-${money(t.discount)}`} />
      )}
      {/* Never $0 and never "Free" below the threshold — the client was
          explicit, because a zero reads as a promise we have not made. */}
      <Row
        label={deliveryKey === "pickup" ? "Pickup" : "Shipping"}
        value={shipping.label}
        data-checkout="shipping-row"
      />
      {isRush && turnaround?.requestedDate ? (
        <>
          <Row
            label="Turnaround"
            value={`Rush Requested — ${formatRequestedDate(turnaround.requestedDate)}`}
            data-checkout="turnaround-row"
          />
          {/* A price the customer can see but we have not set. It is listed
              so the estimate below is plainly not the final number. */}
          <Row
            label="Rush Fee"
            value={RUSH_FEE_LABEL}
            data-checkout="rush-fee-row"
          />
        </>
      ) : null}
      <Row label="Est. GST (5%)" value={money(t.gst)} />
      <div className="flex justify-between border-t border-border mt-1.5 pt-3.5 font-display font-bold text-lg">
        <span>Estimated Total</span>
        <span className="text-accent">{money(t.total)}</span>
      </div>
      {shipping.includedInTotal ? null : (
        <p
          data-checkout="shipping-excluded-note"
          className="text-[12.5px] text-text-tertiary mt-2 mb-0"
        >
          Shipping is not included in this estimate. We will confirm it with
          you after reviewing your order.
        </p>
      )}
      {t.hasUnpricedItems && (
        <p
          data-checkout="unpriced-items-note"
          className="text-[12.5px] text-text-tertiary mt-2 mb-0"
        >
          One or more items above are marked{" "}
          {PRICE_TO_BE_CONFIRMED_LABEL.toLowerCase()} and are not included in
          this estimate. Our team will price them and confirm before you pay.
        </p>
      )}
      {isRush ? (
        <p className="text-[12.5px] text-text-tertiary mt-2 mb-0">
          Any rush charge is confirmed with you before payment — nothing is
          added here.
        </p>
      ) : null}
      <p className="text-[12.5px] text-text-tertiary mt-sp-3 mb-0">
        No payment is due today. Final pricing is confirmed after design review.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  ...rest
}: {
  label: string;
  value: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="flex justify-between gap-3 py-2 text-[14.5px] text-text-secondary"
      {...rest}
    >
      <span className="shrink-0">{label}</span>
      <b className="text-text-primary text-right">{value}</b>
    </div>
  );
}

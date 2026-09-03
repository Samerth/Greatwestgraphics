import type { CartItem } from "@/lib/store/cart";
import { computeCartTotals } from "@/lib/store/cart";
import { money } from "@/lib/utils/quote-pricing";
import type { DeliveryKey } from "@/lib/schemas/checkout";
import { DELIVERY_FEES } from "@/lib/schemas/checkout";
import { RosterTable } from "@/components/shared/RosterTable";

export function CheckoutSummary({
  items,
  deliveryKey,
}: {
  items: CartItem[];
  deliveryKey: DeliveryKey;
}) {
  const fee = DELIVERY_FEES[deliveryKey];
  const t = computeCartTotals(items, fee);

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
              <b>{money(item.qty * item.unit)}</b>
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
      <Row label="Delivery" value={fee === 0 ? "Free" : money(fee)} />
      <Row label="Est. GST (5%)" value={money(t.gst)} />
      <div className="flex justify-between border-t border-border mt-1.5 pt-3.5 font-display font-bold text-lg">
        <span>Current estimate</span>
        <span className="text-accent">{money(t.total)}</span>
      </div>
      <p className="text-[12.5px] text-text-tertiary mt-sp-3 mb-0">
        No payment is due today. Final pricing is confirmed after design review.
      </p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-2 text-[14.5px] text-text-secondary">
      <span>{label}</span>
      <b className="text-text-primary">{value}</b>
    </div>
  );
}

import type { JobRequestDetailResponse } from "@gwg/contracts";
import { DataList, DataRow } from "@/components/ui/DataList";
import { formatRequestedDate } from "@/lib/schemas/checkout";
import { MoneyRow } from "@/components/ui/Money";

/** The client's point 8. Shipping status, carrier and charge are not shown
 *  as figures because nothing in this system persists them today — see
 *  `MoneyRow`'s own doc comment for why `null` is used instead of a
 *  fabricated "$0.00" or blank line. */
export function FulfillmentCard({
  fulfillment,
}: {
  fulfillment: JobRequestDetailResponse["fulfillment"];
}) {
  if (!fulfillment) {
    return (
      <p className="text-sm text-text-secondary m-0">
        Fulfilment details are unavailable for this legacy job.
      </p>
    );
  }
  const isPickup = fulfillment.method === "pickup";
  return (
    <DataList>
      <DataRow label="Method" emphasis>
        {isPickup ? "Pickup — Great West Graphics" : "Shipping"}
      </DataRow>
      {isPickup && !fulfillment.address && (
        <DataRow label="Notes">Hold at the Vancouver studio. No shipping address on file.</DataRow>
      )}
      {fulfillment.address && (
        <DataRow label="Ship to">
          <address className="not-italic">
            {fulfillment.address.address1}
            <br />
            {fulfillment.address.address2 && (
              <>
                {fulfillment.address.address2}
                <br />
              </>
            )}
            {fulfillment.address.city}, {fulfillment.address.region}{" "}
            {fulfillment.address.postalCode}
            <br />
            {fulfillment.address.country}
          </address>
        </DataRow>
      )}
      {!isPickup && (
        <div className="pt-1 border-t border-border">
          <MoneyRow label="Shipping" amountMinor={null} note="Confirmed on the invoice" />
        </div>
      )}
      {fulfillment.turnaround && (
        <DataRow label="Turnaround">
          {fulfillment.turnaround.kind === "rush"
            ? `Rush requested${
                fulfillment.turnaround.requestedDate
                  ? ` — ${formatRequestedDate(fulfillment.turnaround.requestedDate)}`
                  : ""
              }`
            : "Standard production, 5–7 business days"}
        </DataRow>
      )}
      {fulfillment.deliveryNotes && (
        <DataRow label="Delivery instructions">
          <span className="whitespace-pre-wrap">{fulfillment.deliveryNotes}</span>
        </DataRow>
      )}
    </DataList>
  );
}

import type {
  CustomerContactSnapshot,
  FulfillmentSnapshot,
} from "@gwg/contracts";
import { RUSH_FEE_LABEL, formatRequestedDate } from "@/lib/schemas/checkout";

/** `priority` and `rush` are legacy delivery methods — they were production
 *  speeds sold as shipping until row 49 separated the two. Orders placed
 *  before that still carry them, so they still need a label. */
const METHOD_LABEL: Record<FulfillmentSnapshot["method"], string> = {
  standard: "Shipping",
  priority: "Priority line (legacy)",
  rush: "Rush 48-hour (legacy)",
  pickup: "Vancouver pickup",
};

export function OrderHandoff({
  contact,
  fulfillment,
}: {
  contact: CustomerContactSnapshot | null;
  fulfillment: FulfillmentSnapshot | null;
}) {
  return (
    <section className="border border-border rounded-md p-sp-4">
      <h2 className="font-display font-bold text-lg mb-sp-3">
        Contact &amp; fulfilment
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-4 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mt-0 mb-1.5">
            Contact
          </p>
          {contact ? (
            <address className="not-italic m-0">
              <b>{contact.fullName}</b>
              {contact.company ? (
                <span className="block text-text-secondary">{contact.company}</span>
              ) : null}
              <span className="block">{contact.email}</span>
              <span className="block">{contact.phone}</span>
            </address>
          ) : (
            <p className="text-text-secondary m-0">
              Contact details are unavailable for this job.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mt-0 mb-1.5">
            Fulfilment
          </p>
          {fulfillment ? (
            <div>
              <p className="font-semibold m-0">
                {METHOD_LABEL[fulfillment.method]}
              </p>
              {fulfillment.method === "pickup" && !fulfillment.address ? (
                <p className="text-text-secondary m-0">
                  Hold at our Vancouver studio. No shipping address on file.
                </p>
              ) : fulfillment.address ? (
                <address className="not-italic text-text-secondary">
                  {fulfillment.address.address1}
                  {fulfillment.address.address2 ? (
                    <>
                      <br />
                      {fulfillment.address.address2}
                    </>
                  ) : null}
                  <br />
                  {fulfillment.address.city}, {fulfillment.address.region}{" "}
                  {fulfillment.address.postalCode}
                  <br />
                  {fulfillment.address.country}
                </address>
              ) : null}
              {/* The customer asked for a date and was told we would come
                  back on it, so their own order page has to show that the
                  request was actually recorded (UAT row 50). */}
              {fulfillment.turnaround ? (
                <p className="mt-2 mb-0">
                  {fulfillment.turnaround.kind === "rush" ? (
                    <>
                      <b>Rush requested</b>
                      {fulfillment.turnaround.requestedDate
                        ? ` — ${formatRequestedDate(fulfillment.turnaround.requestedDate)}`
                        : ""}
                      <span className="block text-text-secondary">
                        Rush fee: {RUSH_FEE_LABEL}. We will contact you to
                        confirm the date and any charge.
                      </span>
                    </>
                  ) : (
                    <span className="text-text-secondary">
                      Standard production — 5–7 business days
                    </span>
                  )}
                </p>
              ) : null}
              {fulfillment.deliveryNotes ? (
                <p className="text-text-secondary whitespace-pre-wrap mb-0">
                  Note: {fulfillment.deliveryNotes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-text-secondary m-0">
              Fulfilment details are unavailable for this job.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

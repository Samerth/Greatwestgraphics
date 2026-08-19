import type {
  CustomerContactSnapshot,
  FulfillmentSnapshot,
} from "@gwg/contracts";

const METHOD_LABEL: Record<FulfillmentSnapshot["method"], string> = {
  standard: "Standard studio delivery",
  priority: "Priority line",
  rush: "Rush 48-hour",
  pickup: "Studio pickup",
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

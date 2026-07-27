"use client";

import { useState } from "react";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/shared/Button";

const inputClass =
  "w-full rounded-md border border-border bg-bg-raised px-3.5 py-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <section className="py-sp-8">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-sp-6 items-start">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              Talk to the print floor
            </span>
            <h1 className="font-display font-bold text-display leading-display mt-sp-2">
              Tell us what you&apos;re making.
            </h1>
            <p className="text-text-secondary mt-sp-3 max-w-[48ch]">
              Share the product, quantity and deadline. A Vancouver-based specialist
              will help choose the right print method and next step.
            </p>

            <div className="mt-sp-5 space-y-sp-3 text-sm">
              <ContactDetail label="Visit" value="1234 Industrial Ave, Vancouver, BC V6A 1A1" />
              <ContactDetail label="Call" value="(604) 555-0134" />
              <ContactDetail label="Email" value="info@greatwestgraphics.com" />
              <ContactDetail label="Hours" value="Monday–Friday · 8:30am–5:00pm" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-raised p-sp-5">
            {sent ? (
              <div className="min-h-[380px] flex flex-col items-start justify-center">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                  Preview complete
                </span>
                <h2 className="font-display text-header font-bold mt-sp-2">
                  Your form is ready for integration.
                </h2>
                <p className="text-text-secondary mt-sp-2 max-w-[52ch]">
                  This frontend preview does not transmit or save your details. No
                  email or service request was created.
                </p>
                <Button className="mt-sp-4" variant="secondary" onClick={() => setSent(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form
                className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSent(true);
                }}
              >
                <label className="text-sm font-bold">
                  Name
                  <input className={`${inputClass} mt-1.5`} name="name" required />
                </label>
                <label className="text-sm font-bold">
                  Email
                  <input className={`${inputClass} mt-1.5`} name="email" type="email" required />
                </label>
                <label className="text-sm font-bold">
                  Phone
                  <input className={`${inputClass} mt-1.5`} name="phone" type="tel" />
                </label>
                <label className="text-sm font-bold">
                  Company
                  <input className={`${inputClass} mt-1.5`} name="company" />
                </label>
                <label className="text-sm font-bold sm:col-span-2">
                  What can we help with?
                  <select className={`${inputClass} mt-1.5`} name="topic">
                    <option>Screen printing</option>
                    <option>Embroidery</option>
                    <option>Promotional products</option>
                    <option>Signs and displays</option>
                    <option>Design support</option>
                  </select>
                </label>
                <label className="text-sm font-bold sm:col-span-2">
                  Project details
                  <textarea
                    className={`${inputClass} mt-1.5 min-h-32 resize-y`}
                    name="details"
                    required
                    placeholder="Product, quantity, deadline and anything else we should know."
                  />
                </label>
                <div className="sm:col-span-2 pt-sp-2">
                  <Button type="submit">Send project details</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ContactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border pt-sp-2">
      <span className="block text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </span>
      <span className="block mt-1 font-semibold">{value}</span>
    </div>
  );
}

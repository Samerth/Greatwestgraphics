"use client";

import { useState } from "react";
import { trackContactSubmit } from "@/lib/analytics/gtag";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/shared/Button";

const inputClass =
  "w-full min-h-11 rounded-md border border-border bg-bg-raised px-3.5 py-3 text-base font-body text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

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
              <ContactDetail
                label="Visit"
                value="#105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6"
                href="https://goo.gl/maps/ghWtVy9uFPEbsyjg8"
              />
              <ContactDetail label="Call" value="(604) 321-3285" href="tel:+16043213285" />
              <ContactDetail
                label="Email"
                value="info@greatwestgraphics.com"
                href="mailto:info@greatwestgraphics.com"
              />
              <ContactDetail label="Hours" value="Monday–Friday · 8:30am–4:30pm PST" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-raised p-sp-5">
            {sent ? (
              <div className="min-h-[380px] flex flex-col items-start justify-center">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                  Message sent
                </span>
                <h2 className="font-display text-header font-bold mt-sp-2">
                  Thanks — we&apos;ve got it.
                </h2>
                <p className="text-text-secondary mt-sp-2 max-w-[52ch]">
                  A specialist will follow up shortly. In the meantime, feel free
                  to browse the catalogue or build a quote.
                </p>
                <Button className="mt-sp-4" variant="secondary" onClick={() => setSent(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form
                className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError(undefined);
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  const payload = {
                    name: String(data.get("name") || ""),
                    email: String(data.get("email") || ""),
                    phone: String(data.get("phone") || "") || undefined,
                    company: String(data.get("company") || "") || undefined,
                    topic: String(data.get("topic") || "") || undefined,
                    details: String(data.get("details") || ""),
                  };
                  setSubmitting(true);
                  try {
                    const response = await fetch("/api/contact", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    if (!response.ok) {
                      const body = await response.json().catch(() => null);
                      throw new Error(
                        body?.error?.message ||
                          "The message could not be sent. Please try again shortly.",
                      );
                    }
                    setSent(true);
                    trackContactSubmit({
                      method: "contact_form",
                      topic: payload.topic,
                    });
                    form.reset();
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "The message could not be sent. Please try again shortly.",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <label className="text-sm font-bold text-text-primary">
                  Name
                  <input className={`${inputClass} mt-1.5`} name="name" required autoComplete="name" />
                </label>
                <label className="text-sm font-bold text-text-primary">
                  Email
                  <input className={`${inputClass} mt-1.5`} name="email" type="email" required autoComplete="email" />
                </label>
                <label className="text-sm font-bold text-text-primary">
                  Phone
                  <input className={`${inputClass} mt-1.5`} name="phone" type="tel" autoComplete="tel" />
                </label>
                <label className="text-sm font-bold text-text-primary">
                  Company
                  <input className={`${inputClass} mt-1.5`} name="company" autoComplete="organization" />
                </label>
                <label className="text-sm font-bold text-text-primary sm:col-span-2">
                  What can we help with?
                  <select className={`${inputClass} mt-1.5`} name="topic">
                    <option>Screen printing</option>
                    <option>Embroidery</option>
                    <option>Promotional products</option>
                    <option>Signs and displays</option>
                    <option>Design support</option>
                    <option>An existing order or invoice</option>
                  </select>
                </label>
                <label className="text-sm font-bold text-text-primary sm:col-span-2">
                  Project details
                  <textarea
                    className={`${inputClass} mt-1.5 min-h-32 resize-y`}
                    name="details"
                    required
                    placeholder="Product, quantity, deadline and anything else we should know."
                  />
                </label>
                {error && (
                  <p className="sm:col-span-2 text-sm text-red-700 font-semibold" role="alert">
                    {error}
                  </p>
                )}
                <div className="sm:col-span-2 pt-sp-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Sending…" : "Send project details"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ContactDetail({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="border-t border-border pt-sp-2">
      <span className="block text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="block mt-1 font-semibold hover:text-accent transition-colors"
        >
          {value}
        </a>
      ) : (
        <span className="block mt-1 font-semibold">{value}</span>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { trackContactSubmit } from "@/lib/analytics/gtag";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/shared/Button";
import { Pill } from "@/components/quote-builder/QuoteFormControls";

const inputClass =
  "w-full min-h-11 rounded-md border border-border bg-bg-raised px-3.5 py-3 text-base font-body text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

const DECORATION_METHODS = [
  "Screen Print",
  "Embroidery",
  "DTF",
  "Not sure yet",
];

const MAX_ARTWORK_FILES = 5;
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const ARTWORK_ACCEPT = "image/png,image/jpeg,image/svg+xml,application/pdf";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [decorationMethod, setDecorationMethod] = useState<string | null>(null);
  const [artworkFiles, setArtworkFiles] = useState<File[]>([]);
  const [artworkError, setArtworkError] = useState<string>();

  function addArtworkFiles(fileList: FileList | null) {
    if (!fileList) return;
    setArtworkError(undefined);
    const incoming = Array.from(fileList);
    const combined = [...artworkFiles, ...incoming];
    if (combined.length > MAX_ARTWORK_FILES) {
      setArtworkError(`You can attach up to ${MAX_ARTWORK_FILES} files.`);
      return;
    }
    const tooBig = incoming.find((f) => f.size > MAX_ARTWORK_BYTES);
    if (tooBig) {
      setArtworkError(`${tooBig.name} is too large — max 10MB per file.`);
      return;
    }
    setArtworkFiles(combined);
  }

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
              Share the product, quantity, decoration method and artwork — a
              Vancouver-based specialist will follow up with next steps and
              pricing.
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
                  to browse the catalogue or open the design studio.
                </p>
                <Button className="mt-sp-4" variant="secondary" onClick={() => setSent(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form
                className="space-y-sp-5"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError(undefined);
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  if (decorationMethod) data.set("decorationMethod", decorationMethod);
                  for (const file of artworkFiles) data.append("artwork", file);

                  setSubmitting(true);
                  try {
                    const response = await fetch("/api/contact", {
                      method: "POST",
                      body: data,
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
                      topic: String(data.get("topic") || "") || undefined,
                    });
                    form.reset();
                    setDecorationMethod(null);
                    setArtworkFiles([]);
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
                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">
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
                </div>

                <div className="border-t border-border pt-sp-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary mb-sp-3">
                    About the job
                  </p>

                  <label className="text-sm font-bold text-text-primary block mb-sp-3">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3 mb-sp-3">
                    <label className="text-sm font-bold text-text-primary">
                      Product / style
                      <input
                        className={`${inputClass} mt-1.5`}
                        name="product"
                        placeholder="e.g. Gildan 5000 tee, or a link"
                      />
                    </label>
                    <label className="text-sm font-bold text-text-primary">
                      Quantity needed
                      <input
                        className={`${inputClass} mt-1.5`}
                        name="quantity"
                        inputMode="numeric"
                        placeholder="e.g. 48"
                      />
                    </label>
                  </div>

                  <div className="mb-sp-3">
                    <span className="text-sm font-bold text-text-primary block mb-1.5">
                      Decoration method
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {DECORATION_METHODS.map((method) => (
                        <Pill
                          key={method}
                          active={decorationMethod === method}
                          onClick={() => setDecorationMethod(method)}
                        >
                          {method}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <label className="text-sm font-bold text-text-primary block">
                    Needed by <span className="font-normal text-text-tertiary">(optional)</span>
                    <input className={`${inputClass} mt-1.5`} name="neededBy" type="date" />
                  </label>
                </div>

                <div className="border-t border-border pt-sp-4">
                  <span className="text-sm font-bold text-text-primary block mb-1.5">
                    Upload artwork <span className="font-normal text-text-tertiary">(optional — PNG, JPG, SVG, or PDF)</span>
                  </span>
                  <label className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-bg px-4 py-6 text-center cursor-pointer hover:border-accent transition-colors">
                    <span className="text-sm font-bold text-accent">Choose files</span>
                    <span className="text-xs text-text-tertiary">or drag and drop — up to {MAX_ARTWORK_FILES} files, 10MB each</span>
                    <input
                      type="file"
                      multiple
                      accept={ARTWORK_ACCEPT}
                      className="sr-only"
                      onChange={(e) => {
                        addArtworkFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {artworkFiles.length > 0 && (
                    <ul className="mt-sp-2 space-y-1.5">
                      {artworkFiles.map((file, i) => (
                        <li
                          key={`${file.name}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-sm bg-bg px-3 py-2 text-sm"
                        >
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setArtworkFiles((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-text-tertiary hover:text-red-600 font-bold shrink-0"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {artworkError && (
                    <p className="text-[12.5px] text-red-600 font-semibold mt-2">{artworkError}</p>
                  )}
                </div>

                <label className="text-sm font-bold text-text-primary block">
                  Anything else we should know? <span className="font-normal text-text-tertiary">(optional)</span>
                  <textarea
                    className={`${inputClass} mt-1.5 min-h-24 resize-y`}
                    name="details"
                    placeholder="Deadline, budget, colours — anything that helps us quote accurately."
                  />
                </label>

                {error && (
                  <p className="text-sm text-red-700 font-semibold" role="alert">
                    {error}
                  </p>
                )}
                <div className="pt-sp-1">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Sending…" : "Request my quote"}
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

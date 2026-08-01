"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input, Textarea } from "@/components/checkout/FormField";
import { Button } from "@/components/shared/Button";

const ACCENT_PRESETS = [
  { label: "Orange", value: "#AA3300" },
  { label: "Blue", value: "#132A66" },
  { label: "Green", value: "#1E6B3C" },
  { label: "Purple", value: "#5B2A86" },
  { label: "Black", value: "#1A1A1A" },
];

export function StoreWizard() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [accentColor, setAccentColor] = useState(ACCENT_PRESETS[0]!.value);
  const [logoUrl, setLogoUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (slugTouched || !companyName.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/stores/suggest-slug?base=${encodeURIComponent(companyName)}`,
        );
        const data = await response.json();
        if (data.slug) setSlug(data.slug);
      } catch {
        // Non-critical — the field stays editable either way.
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [companyName, slugTouched]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const response = await fetch("/api/stores/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountName: companyName,
          storeName: companyName,
          slug,
          accentColor,
          logoUrl,
          tagline,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Could not create your store.");
      }
      router.push("/start/pending");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your store.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg">
      <Field label="Company or team name">
        <Input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          autoFocus
        />
      </Field>

      <Field label="Your store address">
        <div className="flex items-center border border-border rounded-sm bg-bg-raised overflow-hidden focus-within:border-accent">
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
            required
            className="flex-1 min-w-0 px-3 py-2.5 bg-transparent focus:outline-none"
          />
          <span className="px-3 py-2.5 text-sm text-text-tertiary bg-fill-subtle-15 whitespace-nowrap">
            .greatwestgraphics.com
          </span>
        </div>
        {slug && (
          <p className="text-[12.5px] text-text-tertiary mt-1.5">
            Your store will be at{" "}
            <b className="text-text-primary">{slug}.greatwestgraphics.com</b>
          </p>
        )}
      </Field>

      <Field label="Accent colour">
        <div className="flex gap-2 flex-wrap">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setAccentColor(preset.value)}
              aria-label={preset.label}
              style={{ background: preset.value }}
              className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-105 ${
                accentColor === preset.value
                  ? "border-text-primary scale-110"
                  : "border-white shadow-[0_0_0_1px_var(--color-border)]"
              }`}
            />
          ))}
        </div>
      </Field>

      <Field label="Logo URL (optional — you can add this later)">
        <Input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <Field label="Tagline (optional)">
        <Textarea
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="min-h-16"
          placeholder="Custom apparel for the Acme team"
        />
      </Field>

      {error && <p className="text-[13px] text-red-600 font-semibold mb-sp-3">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating your store…" : "Create my store"}
      </Button>
      <p className="text-[12px] text-text-tertiary mt-sp-3">
        A specialist reviews every new store before it goes live — usually within
        one business day.
      </p>
    </form>
  );
}

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

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const MAX_LOGO_BYTES = 10 * 1024 * 1024;

export function StoreWizard() {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [accentColor, setAccentColor] = useState(ACCENT_PRESETS[0]!.value);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const preview = URL.createObjectURL(logoFile);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [logoFile]);

  function chooseLogo(file: File | undefined) {
    setError(undefined);
    if (!file) {
      setLogoFile(null);
      return;
    }
    if (file.type && !LOGO_TYPES.has(file.type)) {
      setError("Unsupported file type — use PNG, JPG or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("File is too large — max 10MB.");
      return;
    }
    setLogoFile(file);
  }

  async function uploadLogo(): Promise<string | undefined> {
    if (!logoFile) return undefined;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", logoFile);
      form.append("purpose", "store-logo");
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error?.message || "Could not upload your logo.");
      }
      return String(payload.url);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const logoUrl = await uploadLogo();
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

      <Field label="Logo (optional)">
        <input
          ref={logoInputRef}
          id="store-logo"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="sr-only"
          onChange={(e) => chooseLogo(e.target.files?.[0])}
        />
        {logoPreview ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-bg-raised p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoPreview}
              alt=""
              className="h-14 w-14 shrink-0 rounded-sm object-contain border border-border bg-white"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold truncate">{logoFile?.name}</p>
              <p className="m-0 mt-1 text-[12px] text-text-tertiary">
                PNG, JPG or SVG · max 10MB
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="text-sm font-bold text-accent hover:underline"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoFile(null);
                  if (logoInputRef.current) logoInputRef.current.value = "";
                }}
                className="text-sm font-bold text-text-secondary hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="w-full border border-dashed border-border rounded-md py-6 px-4 text-left hover:border-accent hover:bg-accent-tint transition-colors"
          >
            <span className="block font-bold text-sm">Upload your logo</span>
            <span className="block mt-1 text-[12.5px] text-text-tertiary">
              PNG, JPG or SVG. Max 10MB. This appears in your store header.
            </span>
          </button>
        )}
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
        {uploadingLogo
          ? "Uploading logo…"
          : submitting
            ? "Creating your store…"
            : "Create my store"}
      </Button>
      <p className="text-[12px] text-text-tertiary mt-sp-3">
        A specialist reviews every new store before it goes live — usually within
        one business day.
      </p>
    </form>
  );
}

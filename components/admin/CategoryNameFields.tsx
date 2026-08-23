"use client";

import { useState } from "react";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CategoryNameFields({
  defaultName = "",
  defaultSlug = "",
  defaultParentId = "",
  parentOptions = [],
  nameId,
  mode = "create",
}: {
  defaultName?: string;
  defaultSlug?: string;
  defaultParentId?: string;
  parentOptions?: { id: string; name: string }[];
  nameId?: string;
  mode?: "create" | "edit";
}) {
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(defaultSlug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultSlug));
  const previewSlug = slugTouched ? slug : slugify(name);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm font-semibold min-w-[14rem] flex-1">
          Category name
          <input
            id={nameId}
            name="name"
            required
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!slugTouched) setSlug(slugify(next));
            }}
            placeholder={mode === "create" ? "e.g. T-Shirts" : undefined}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold min-w-[14rem] flex-1">
          Parent category
          <select
            name="parentId"
            defaultValue={defaultParentId}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 font-normal bg-bg"
          >
            <option value="">None (top-level Shop menu item)</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <span className="block mt-1 text-xs font-normal text-text-tertiary">
            Leave as &quot;None&quot; for a main category (e.g. &quot;T-Shirts&quot;).
            Pick a parent to make this a subcategory (e.g. &quot;Short Sleeve&quot;
            under &quot;T-Shirts&quot;).
          </span>
        </label>
      </div>
      <details className="basis-full sm:basis-auto sm:min-w-[16rem]">
        <summary className="text-sm font-semibold text-text-secondary cursor-pointer select-none">
          Advanced: URL name
        </summary>
        <label className="block mt-2 text-sm font-semibold">
          URL name (slug)
          <input
            name="slug"
            value={previewSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder="auto-from-name"
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 font-mono text-xs font-normal"
          />
          <span className="block mt-1 text-xs font-normal text-text-tertiary">
            Used in website links. Leave alone unless you need a specific URL —
            we fill this in from the category name.
          </span>
        </label>
      </details>
    </div>
  );
}
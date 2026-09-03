"use client";

import { useActionState } from "react";
import {
  updateCategoryAction,
  type CategoryFormState,
} from "@/app/admin/actions";
import { CategoryNameFields } from "@/components/admin/CategoryNameFields";

const initialState: CategoryFormState = {};

/** Same fix as `AddCategoryForm`, for the "Save changes" row-edit form:
 *  renaming a category used to give no confirmation either, which is the
 *  same silent-success trap in a second place on this page. */
export function EditCategoryForm({
  categoryId,
  defaultName,
  defaultSlug,
  parentOptions,
  methodOptions,
  locationOptions,
  defaultAllowedDecorationMethods,
  defaultAllowedDecorationLocations,
}: {
  categoryId: string;
  defaultName: string;
  defaultSlug: string;
  parentOptions: { id: string; name: string }[];
  /** Decoration methods/locations available to restrict this category to
   * (CodSphere UAT — "Product-Specific Decoration Methods & Print
   * Locations"). Omit both to hide this section entirely. */
  methodOptions?: { key: string; label: string }[];
  locationOptions?: { key: string; label: string }[];
  /** `null` (or nothing checked) means unrestricted. */
  defaultAllowedDecorationMethods?: string[] | null;
  defaultAllowedDecorationLocations?: string[] | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateCategoryAction.bind(null, categoryId),
    initialState,
  );
  const checkedMethods = new Set(defaultAllowedDecorationMethods ?? []);
  const checkedLocations = new Set(defaultAllowedDecorationLocations ?? []);

  return (
    <form action={formAction} className="space-y-sp-3">
      <CategoryNameFields
        mode="edit"
        defaultName={defaultName}
        defaultSlug={defaultSlug}
        defaultParentId=""
        parentOptions={parentOptions}
      />
      {methodOptions && methodOptions.length > 0 && (
        <div className="border border-border rounded-sm p-sp-3">
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary m-0 mb-2">
            Allowed decoration methods
          </p>
          <p className="text-xs text-text-tertiary m-0 mb-2">
            Leave every box unchecked to allow every method (default). Check
            specific methods to restrict this category — e.g. Hats: only
            Embroidery.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {methodOptions.map((m) => (
              <label
                key={m.key}
                className="flex items-center gap-1.5 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="allowedDecorationMethods"
                  value={m.key}
                  defaultChecked={checkedMethods.has(m.key)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {locationOptions && locationOptions.length > 0 && (
        <div className="border border-border rounded-sm p-sp-3">
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary m-0 mb-2">
            Allowed decoration locations
          </p>
          <p className="text-xs text-text-tertiary m-0 mb-2">
            Leave every box unchecked to allow every location (default). Check
            specific locations to restrict this category — e.g. Bags: only
            Front/Back.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {locationOptions.map((l) => (
              <label
                key={l.key}
                className="flex items-center gap-1.5 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="allowedDecorationLocations"
                  value={l.key}
                  defaultChecked={checkedLocations.has(l.key)}
                />
                {l.label}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-bold text-accent px-3 py-2 border border-border rounded-sm hover:bg-fill-subtle-15 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p className="text-xs text-text-tertiary m-0">
          Tip: rename for shoppers anytime; only touch the URL name if an old
          link must stay the same.
        </p>
      </div>
      {state.error && (
        <p
          role="alert"
          className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0"
        >
          {state.error}
        </p>
      )}
      {!state.error && state.savedAt && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-sm px-3 py-2 m-0">
          Saved.
        </p>
      )}
    </form>
  );
}

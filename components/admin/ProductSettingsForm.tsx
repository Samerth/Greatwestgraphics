"use client";

import { useActionState } from "react";
import {
  patchProductAction,
  type PatchProductState,
} from "@/app/admin/actions";

const initialState: PatchProductState = {};

export function ProductSettingsForm({
  productId,
  storefrontVisible,
  isDark,
  active,
  categories,
  assignedIds,
}: {
  productId: string;
  storefrontVisible: boolean;
  isDark: boolean;
  active: boolean;
  categories: Record<string, unknown>[];
  assignedIds: Set<string>;
}) {
  const [state, formAction, pending] = useActionState(
    patchProductAction.bind(null, productId),
    initialState,
  );

  return (
    <form
      action={formAction}
      className="border border-border rounded-md p-sp-4 space-y-sp-3 bg-bg-raised"
    >
      <h2 className="font-display font-bold text-lg m-0">Storefront</h2>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="storefrontVisible" defaultChecked={storefrontVisible} />
        Visible on storefront
      </label>
      <p className="text-xs text-text-tertiary m-0">
        Soft-hide omits this colorway from PLP, brands, sitemap, and design
        picker. Vendor sync will not un-hide it.
      </p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="isDark" defaultChecked={isDark} />
        Dark garment (pricing premium)
      </label>
      <input type="hidden" name="touchActive" value="1" />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={active} />
        Vendor active (not discontinued)
      </label>
      <fieldset>
        <legend className="text-sm font-semibold mb-2">
          Category override (wins over map)
        </legend>
        <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-auto">
          {categories.map((cat) => (
            <label key={String(cat.id)} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="categoryIds"
                value={String(cat.id)}
                defaultChecked={assignedIds.has(String(cat.id))}
              />
              {String(cat.name)}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0">
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
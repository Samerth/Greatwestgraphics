"use client";

import { useActionState } from "react";
import {
  setStorePricingAdjustmentAction,
  type PricingAdjustmentState,
} from "@/app/admin/actions";

const initialState: PricingAdjustmentState = {};

export function StorePricingAdjustmentForm({
  storeId,
  defaultValue,
}: {
  storeId: string;
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState(
    setStorePricingAdjustmentAction.bind(null, storeId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-end gap-3">
        <label className="text-sm font-bold">
          Adjustment %
          <input
            type="number"
            step="0.1"
            min={-90}
            max={200}
            name="percent"
            defaultValue={defaultValue}
            placeholder="0"
            className="block mt-1.5 w-32 rounded-md border border-border bg-bg-page px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-bold px-3 py-2 rounded-sm bg-accent text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
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
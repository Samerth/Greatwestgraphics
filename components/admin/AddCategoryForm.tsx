"use client";

import { useActionState } from "react";
import {
  createCategoryAction,
  type CategoryFormState,
} from "@/app/admin/actions";
import { CategoryNameFields } from "@/components/admin/CategoryNameFields";

const initialState: CategoryFormState = {};

/**
 * Fixes the exact failure the client's team hit: submitting this form used
 * to give no feedback at all (revalidate-only server action, plain
 * `<form action={...}>`) — a successful add genuinely looked like nothing
 * happened, which is what led an admin to submit the same name twice and
 * hit a raw duplicate-slug crash on the second attempt.
 *
 * `useActionState` makes both halves visible: a green "Added" confirmation
 * on success (so there is no reason to click again), and a red inline
 * message instead of a page-level crash on failure.
 */
export function AddCategoryForm({
  parentOptions,
}: {
  parentOptions: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-sp-3">
      <CategoryNameFields
        mode="create"
        nameId="new-category-name"
        parentOptions={parentOptions}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add a category"}
        </button>
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
            Added &quot;{state.name}&quot; — find it in the list below.
          </p>
        )}
      </div>
    </form>
  );
}

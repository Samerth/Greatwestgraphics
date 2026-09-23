"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/shared/Button";
import { deleteDesignAction } from "@/app/portal/designs/actions";

/**
 * Open / Delete for one saved-design card. Delete used to fire straight off
 * a single click — no confirmation of any kind, for a permanent delete with
 * no undo (audit: "Deleting a saved design asks nothing"). Two-step,
 * matching the Design Studio's own "Discard and start over" pattern exactly
 * — a plain inline confirm, not a browser `confirm()`, which this codebase
 * uses nowhere else.
 */
export function DesignCardActions({
  id,
  openHref,
}: {
  id: string;
  openHref: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirming) {
    return (
      <div className="w-full flex flex-col gap-2">
        <p className="m-0 text-[12px] text-text-secondary">
          Delete this design? This can&apos;t be undone.
        </p>
        <div className="flex gap-2">
          <form
            action={deleteDesignAction.bind(null, id)}
            className="flex-1"
            onSubmit={() => setDeleting(true)}
          >
            <button
              type="submit"
              disabled={deleting}
              className="min-h-9 w-full rounded-sm bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="min-h-9 flex-1 rounded-sm border border-border px-3 py-1.5 text-sm font-bold disabled:opacity-60"
          >
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 w-full">
      <ButtonLink href={openHref} variant="secondary" size="sm" className="flex-1">
        Open
      </ButtonLink>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-bold px-3 py-2 rounded-sm border border-border hover:border-red-300 hover:text-red-700 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}

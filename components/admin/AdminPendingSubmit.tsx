"use client";

import { useFormStatus } from "react-dom";

export function AdminPendingSubmit({
  idleLabel,
  pendingLabel,
  className,
  disabled,
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={className}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
          {pendingLabel}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}

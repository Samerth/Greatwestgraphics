"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Textarea } from "./FormField";
import { Button } from "@/components/shared/Button";

const reviewSchema = z.object({
  studioNotes: z.string().max(4_000, "Keep notes under 4,000 characters").optional(),
});
type ReviewValues = z.infer<typeof reviewSchema>;

export function PaymentStep({
  onBack,
  onSubmit,
  error,
}: {
  onBack: () => void;
  onSubmit: (notes: string | undefined) => Promise<void>;
  error?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
  });

  return (
    <form onSubmit={handleSubmit(({ studioNotes }) => onSubmit(studioNotes))}>
      <h2 className="font-display font-bold text-header mb-sp-4">
        Submit for Design Review
      </h2>
      <div className="border border-accent bg-accent-tint rounded-md p-sp-3 mb-sp-4 text-sm">
        <b>No payment is collected now.</b> Our team will review your design,
        confirm availability, and send final pricing before payment becomes
        available.
      </div>

      <div className="border border-border rounded-md p-sp-3 mb-sp-4 text-sm text-text-secondary">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Submit your cart, delivery details, and notes.</li>
          <li>We review artwork and prepare final pricing.</li>
          <li>You approve the proof and pay only when the job is payment-ready.</li>
        </ol>
      </div>

      <Field label="Notes to the Studio" error={errors.studioNotes?.message}>
        <Textarea
          rows={3}
          placeholder="Deadlines, PO numbers, artwork placement, anything our team should know before we proof."
          {...register("studioNotes")}
        />
      </Field>

      {error && (
        <div role="alert" className="border border-red-300 bg-red-50 text-red-800 rounded-md p-sp-3 mt-sp-3 text-sm">
          {error} Your cart is still saved. Retry when ready.
        </div>
      )}

      <div className="flex justify-between mt-sp-4">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : error ? "Retry Submission" : "Submit for Review"}
        </Button>
      </div>
    </form>
  );
}

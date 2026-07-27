"use client";

import { motion } from "framer-motion";
import { ButtonLink } from "@/components/shared/Button";
import type { JobRequestResponse } from "@gwg/contracts";

export function CheckoutSuccess({
  jobRequest,
}: {
  jobRequest: JobRequestResponse;
}) {
  return (
    <div className="text-center py-sp-8 px-sp-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 0.8, 0.3, 1] }}
        className="w-16 h-16 rounded-full bg-accent text-white grid place-items-center mx-auto mb-sp-4"
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </motion.div>
      <h2 className="font-display font-bold text-header mb-sp-2">
        Your job is submitted for review.
      </h2>
      <p className="text-text-secondary max-w-[46ch] mx-auto">
        No payment was collected. We’ll review the design and prepare final
        pricing before payment becomes available.
      </p>
      <p className="mt-sp-3 text-sm">
        Job reference: <b className="font-mono">{jobRequest.id}</b>
      </p>
      <ButtonLink
        href={`/portal/jobs/${jobRequest.id}`}
        className="mt-sp-4 inline-flex"
      >
        View Job Status
      </ButtonLink>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SizeChartTable } from "./SizeChartTable";

export interface SizeChartModalProps {
  styleKey: string;
  productName: string;
  onClose: () => void;
}

/**
 * Modal dialog displaying size chart for a garment.
 * Rendered full-screen on mobile, centered overlay on desktop.
 */
export function SizeChartModal({ styleKey, productName, onClose }: SizeChartModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
        <div className="bg-bg-raised w-full lg:w-full lg:max-w-lg rounded-t-lg lg:rounded-lg border border-border lg:shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-bg-raised border-b border-border px-sp-5 py-sp-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg">{productName}</h2>
              <p className="text-xs text-text-tertiary mt-0.5">Size Guide</p>
            </div>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary transition-colors text-2xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="px-sp-5 py-sp-4">
            <SizeChartTable styleKey={styleKey} />
          </div>

          {/* Footer */}
          <div className="border-t border-border px-sp-5 py-sp-4 bg-bg-raised/50 text-xs text-text-tertiary">
            <p>💡 Still unsure about your size? <Link href="/contact" className="text-accent hover:underline">Contact us</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}

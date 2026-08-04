"use client";

import { useState } from "react";

export interface SizeChartPDFViewerProps {
  pdfUrl: string;
  label: string;
  productName: string;
}

/**
 * Modal PDF viewer for size charts.
 * Opens the PDF in fullscreen on mobile, centered modal on desktop.
 * Falls back to link if browser doesn't support embedded PDFs.
 */
export function SizeChartPDFViewer({
  pdfUrl,
  label,
  productName,
}: SizeChartPDFViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <>
      {/* Open Button */}
      <div className="mt-sp-4 pt-sp-4 border-t border-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border text-text-primary hover:border-text-tertiary hover:bg-bg-raised transition-colors text-sm font-semibold flex-1 sm:flex-none justify-center"
          >
            <span>📄</span>
            View Size Chart
          </button>
          <a
            href={pdfUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border text-text-primary hover:border-text-tertiary hover:bg-bg-raised transition-colors text-sm font-semibold justify-center"
          >
            <span>⬇️</span>
            Download PDF
          </a>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center p-4">
            <div className="bg-bg-raised w-full lg:w-11/12 lg:max-h-[90vh] rounded-t-lg lg:rounded-lg border border-border lg:shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="sticky top-0 bg-bg-raised border-b border-border px-sp-5 py-sp-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="font-display font-bold text-lg">{productName}</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">{label}</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-text-tertiary hover:text-text-primary transition-colors text-2xl leading-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 relative overflow-hidden bg-bg">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm text-text-secondary">Loading PDF...</p>
                    </div>
                  </div>
                )}

                {hasError && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="text-center px-sp-4">
                      <p className="text-sm font-semibold text-red-600 mb-2">
                        Unable to load PDF preview
                      </p>
                      <p className="text-xs text-text-secondary mb-sp-3">
                        Your browser may not support PDF preview. Use the download
                        button instead.
                      </p>
                      <a
                        href={pdfUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
                      >
                        Download PDF
                      </a>
                    </div>
                  </div>
                )}

                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  className="w-full h-full border-0"
                  title={`Size chart PDF for ${productName}`}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                />
              </div>

              {/* Footer */}
              <div className="border-t border-border px-sp-5 py-sp-3 bg-bg-raised/50 text-xs text-text-tertiary flex items-center justify-between">
                <p>💡 Use your browser tools to zoom, print, or download</p>
                <a
                  href={pdfUrl}
                  download
                  className="text-accent hover:underline font-semibold"
                >
                  Download
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

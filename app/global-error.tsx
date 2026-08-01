"use client";

import { useEffect } from "react";

// Last-resort boundary — only fires if the root layout itself throws
// (everything under app/(shop)/error.tsx and app/admin/error.tsx handles
// its own area first). Must render its own <html>/<body>: this replaces
// the root layout, not wraps it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            Something went wrong.
          </h1>
          <p style={{ color: "#666", marginBottom: 24 }}>
            Please try again, or reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#AA3300",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

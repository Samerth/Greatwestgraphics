import Script from "next/script";

/**
 * Public per-widget key. Safe in source: it is rendered into the HTML of every
 * page by design, and CodCRM protects the widget with an origin allowlist plus
 * signed embed tokens rather than by keeping this string private.
 *
 * Deliberately not an env var. NEXT_PUBLIC_* is inlined at build time and the
 * Dockerfile passes no build args, so an env-only value can never reach the
 * bundle in a container build — the widget would silently never appear on
 * staging. The override below exists for a future second widget.
 */
const DEFAULT_WIDGET_KEY = "cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_";
const WIDGET_KEY =
  process.env.NEXT_PUBLIC_CODCHAT_WIDGET_KEY || DEFAULT_WIDGET_KEY;
const LOADER_SRC = "https://www.codcrm.com/chat/widget.js";

/**
 * CodChat website assistant (CodCRM).
 *
 * The loader reads its own `data-widget-key` off `document.currentScript`, so
 * two things have to hold. next/script copies every non-reserved prop onto the
 * injected tag via `setAttribute`, so the attribute survives; and it appends a
 * classic external script to <body>, which does set `currentScript` while that
 * script runs. `afterInteractive` is therefore safe — the widget key arrives.
 *
 * The loader then injects a fixed-position iframe of its own and talks to it
 * over postMessage to resize between launcher and open panel, so there is
 * nothing to lay out here.
 *
 * Renders nothing when the key is unset, which keeps local and preview builds
 * free of a chat bubble nobody configured. Note that NEXT_PUBLIC_* values are
 * inlined at build time, so each environment needs this present when its image
 * is built — setting it only at runtime will not reach the browser.
 */
export function CodChatWidget() {
  if (!WIDGET_KEY) return null;

  return (
    <Script
      src={LOADER_SRC}
      data-widget-key={WIDGET_KEY}
      strategy="afterInteractive"
    />
  );
}

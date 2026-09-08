import Script from "next/script";

const WIDGET_KEY = process.env.NEXT_PUBLIC_CODCHAT_WIDGET_KEY;
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

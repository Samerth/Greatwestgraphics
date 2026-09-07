import type { Config } from "tailwindcss";

// Ported 1:1 from the original styles.css :root design tokens.
// Colors stay wired to CSS variables (not hardcoded) so the
// existing data-theme="orange" / data-theme="blue" runtime swap
// keeps working exactly as it did in the static mockup.

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        "bg-90": "var(--color-bg-90)",
        "bg-raised": "var(--color-bg-raised)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-tertiary": "var(--color-text-tertiary)",
        border: "var(--color-border)",
        "fill-subtle": "var(--color-fill-subtle)",
        "fill-subtle-15": "var(--color-fill-subtle-15)",
        accent: "var(--color-accent)",
        // Legible form of the accent for near-black surfaces — see globals.css.
        "accent-on-dark": "var(--color-accent-on-dark)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-tint": "var(--color-accent-tint)",
        "accent-tint-strong": "var(--color-accent-tint-strong)",
        // Navy as a section background (top bar, trust band, footer) —
        // distinct from the accent, which is action-colour now. See
        // globals.css for why these are two separate token families.
        band: "var(--color-band-bg)",
        "band-raised": "var(--color-band-bg-raised)",
        "band-fg": "var(--color-band-fg)",
        "band-fg-dim": "var(--color-band-fg-dim)",
        "band-border": "var(--color-band-border)",
      },
      spacing: {
        "sp-1": "4px",
        "sp-2": "8px",
        "sp-3": "16px",
        "sp-4": "24px",
        "sp-5": "32px",
        "sp-6": "48px",
        "sp-7": "64px",
        "sp-8": "96px",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["var(--fs-display)", { lineHeight: "var(--lh-display)" }],
        // The mockup's section-heading step (38px/regular) — sized here,
        // weight left to each call site. See globals.css for the rationale.
        section: ["var(--fs-section)", { lineHeight: "var(--lh-section)" }],
        header: ["var(--fs-header)", { lineHeight: "var(--lh-header)" }],
        body: ["var(--fs-body)", { lineHeight: "var(--lh-body)" }],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      transitionTimingFunction: {
        "ease-out-custom": "cubic-bezier(.16,.8,.3,1)",
      },
      transitionDuration: {
        fast: "140ms",
        med: "220ms",
      },
      maxWidth: {
        // Was 1280px — measured against the mockup's own content width at
        // 1920px (its header content spans 1440px, ours spanned 1280px),
        // which meant 320px of dead margin on each side of a wide monitor
        // versus their 240px. `Container` is the one place this is set, so
        // raising it here widens the whole site — header, hero, every
        // homepage section, the catalogue — consistently rather than
        // page-by-page.
        container: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;

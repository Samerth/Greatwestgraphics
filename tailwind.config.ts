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
        "bg-raised": "var(--color-bg-raised)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-tertiary": "var(--color-text-tertiary)",
        border: "var(--color-border)",
        "fill-subtle": "var(--color-fill-subtle)",
        "fill-subtle-15": "var(--color-fill-subtle-15)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-tint": "var(--color-accent-tint)",
        "accent-tint-strong": "var(--color-accent-tint-strong)",
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
        container: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;

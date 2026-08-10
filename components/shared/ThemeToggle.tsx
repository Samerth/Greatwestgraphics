"use client";

import { useEffect, useState } from "react";

type ThemeName = "orange" | "blue";
const STORAGE_KEY = "gwg-theme";
const DEFAULT_THEME: ThemeName = "blue";

function readStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "orange" || stored === "blue") return stored;
  } catch {
    // private browsing / blocked storage
  }
  return DEFAULT_THEME;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  // Re-apply persisted theme on every mount. Without this, App Router
  // navigations keep the server `data-theme` and the toggle appears to
  // "reset" (handoff flag from live-site audit).
  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
    setMounted(true);
  }, []);

  function apply(next: ThemeName) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can fail in private-browsing contexts — toggle still
      // works for the current session, it just won't persist.
    }
  }

  if (!mounted) return null;

  return (
    <div
      role="group"
      aria-label="Theme"
      className="fixed left-sp-4 bottom-sp-4 z-[70] flex items-center gap-1 rounded-full bg-text-primary p-1 shadow-[0_8px_24px_rgba(0,0,0,.25)]"
    >
      <button
        type="button"
        onClick={() => apply("orange")}
        aria-pressed={theme === "orange"}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors ${
          theme === "orange" ? "bg-[#AA3300] text-white" : "text-white/60 hover:text-white/85"
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#AA3300] ring-1 ring-white/40" />
        Orange
      </button>
      <button
        type="button"
        onClick={() => apply("blue")}
        aria-pressed={theme === "blue"}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors ${
          theme === "blue" ? "bg-[#132A66] text-white" : "text-white/60 hover:text-white/85"
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#132A66] ring-1 ring-white/40" />
        Blue
      </button>
    </div>
  );
}

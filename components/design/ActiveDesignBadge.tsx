"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";

export function ActiveDesignBadge() {
  const artworksBySide = useActiveDesignStore((s) => s.artworksBySide);
  const name = useActiveDesignStore((s) => s.name);
  const clear = useActiveDesignStore((s) => s.clear);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !hasActiveArtwork(artworksBySide)) return null;

  return (
    <span className="hidden md:inline-flex items-center gap-1 rounded-md border border-accent bg-accent-tint pl-3 pr-1.5 py-1.5 text-xs font-bold text-accent">
      <Link href="/design" className="hover:underline">
        {name || "Your design"}
      </Link>
      <button
        type="button"
        onClick={() => clear()}
        aria-label="Clear active design"
        title="Clear active design"
        className="ml-1 w-5 h-5 grid place-items-center rounded-full hover:bg-accent hover:text-white transition-colors"
      >
        ×
      </button>
    </span>
  );
}

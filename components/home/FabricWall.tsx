"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { RecolorGarment } from "@/components/pdp/RecolorGarment";
import { ButtonLink } from "@/components/shared/Button";
import { publicQuoteOrFallback } from "@/lib/features";

// `search` is the catalogue term the "Shop this colour" link uses. It is
// deliberately broader than the ink name: these are Great West's stock ink
// colours, while the catalogue stores each manufacturer's own colour names,
// so linking the literal ink name would dead-end on an empty result page
// for anything the vendors don't happen to call the same thing.
const SWATCHES = [
  { hex: "#1d2a44", name: "Navy", search: "Navy" },
  { hex: "#1b1b1b", name: "Ink Black", search: "Black" },
  { hex: "#AA3300", name: "Burnt Orange", search: "Orange" },
  { hex: "#2d4a38", name: "Forest", search: "Forest" },
  { hex: "#5c2430", name: "Burgundy", search: "Burgundy" },
  { hex: "#3d5670", name: "Steel Blue", search: "Blue" },
  { hex: "#5a5a3c", name: "Olive", search: "Olive" },
  { hex: "#e8e0d0", name: "Natural", search: "Natural" },
  { hex: "#a8a8ac", name: "Ash Grey", search: "Grey" },
  { hex: "#c08a8a", name: "Dusty Rose", search: "Pink" },
];

export function FabricWall() {
  const [active, setActive] = useState(SWATCHES[0]);

  return (
    <section className="py-sp-8 bg-bg-raised border-y border-border">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24 grid grid-cols-1 md:grid-cols-2 gap-sp-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            The Fabric Wall
          </div>
          <h2 className="font-display font-bold text-[clamp(30px,4vw,52px)] leading-[1.05] tracking-tight my-sp-3">
            37 stock ink colours.
            <br />
            <span className="text-accent">Pick yours.</span>
          </h2>
          <p className="text-text-secondary max-w-[42ch] mb-sp-5 text-[15px]">
            Not little circles on a product page — the whole garment changes. Hover a
            swatch below to preview a few, or ask about full Pantone matching.
          </p>

          <div className="grid grid-cols-5 gap-3 max-w-[300px]">
            {SWATCHES.map((s) => (
              <button
                key={s.name}
                type="button"
                aria-label={`Preview ${s.name}`}
                aria-pressed={active.name === s.name}
                onMouseEnter={() => setActive(s)}
                onFocus={() => setActive(s)}
                onClick={() => setActive(s)}
                style={{ background: s.hex }}
                className={cn(
                  "w-[54px] h-[54px] rounded-[14px] border-2 border-white shadow-[0_0_0_1px_var(--color-border)] transition-transform hover:scale-105",
                  active.name === s.name && "scale-105 shadow-[0_0_0_3px_var(--color-accent)]"
                )}
              />
            ))}
          </div>

          <div className="mt-sp-4 font-display font-bold">
            <b className="text-xl">{active.name}</b>
            <span className="block font-body font-semibold text-[13.5px] text-text-tertiary mt-0.5 tracking-wide">
              in stock · S–4XL · Premium 400gsm fleece
            </span>
          </div>

          <div className="mt-sp-4 flex flex-wrap gap-2.5">
            <ButtonLink
              href={`/products?q=${encodeURIComponent(active.search)}`}
              variant="primary"
              size="sm"
            >
              Shop garments in this colour
            </ButtonLink>
            <ButtonLink
              href={publicQuoteOrFallback("/contact")}
              variant="secondary"
              size="sm"
            >
              Ask about Pantone matching
            </ButtonLink>
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden p-sp-5 bg-[radial-gradient(80%_90%_at_30%_20%,rgba(255,255,255,.5),transparent_60%),linear-gradient(160deg,#ECE9E1_0%,#D6D2C7_100%)] min-h-[460px] flex items-center justify-center shadow-[inset_0_0_0_1px_var(--color-border)]">
          <RecolorGarment
            maskSrc="/images/hoodie.png"
            color={active.hex}
            className="w-[82%] max-w-[420px] h-[420px] max-h-[60vh] drop-shadow-[0_30px_40px_rgba(0,0,0,.18)]"
          />
          <span className="absolute left-sp-4 bottom-sp-4 bg-white/90 backdrop-blur border border-border px-3.5 py-2 rounded-full text-[13px] font-bold">
            Premium 400gsm fleece · {active.name}
          </span>
        </div>
      </div>
    </section>
  );
}

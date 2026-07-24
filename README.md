# Great West Graphics — Next.js rebuild

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind · Framer Motion · Zustand · Drizzle/Neon (pending) · React Hook Form + Zod

## Status
- [x] Project scaffold, design tokens ported 1:1 from styles.css into tailwind.config.ts
- [x] Header/Footer/TickBar (shared layout)
- [x] Homepage — full conversion: Hero, Quick Paths, Walk the Floor (hover stations),
      Fabric Wall (swatch-hover garment recolor), Trust Strip, Bestseller Roller
      (auto-scroll + controls), Product Universe (reuses ProductsGrid), Testimonials,
      Quote Builder, Gallery, Stats, CTA band
- [x] Cart page (Zustand store, same discount tiers as original script.js)
- [x] PDP: recolorable garment (CSS mask, swap to real transparent PNGs in /public/images)
- [x] Products listing grid (bento tiles, category filter, sort — built from the "Full
      Catalogue" mockup; NOT final Figma yet, layout/copy is provisional)
- [x] Design Studio: assets panel, canvas (garment recolor + artwork overlay + tools),
      AI prompt flow (simulated regenerate), live mockup panel
- [x] Checkout: full 4-step wizard (Contact/Shipping/Delivery/Payment), react-hook-form
      + zod validation per step, live order summary, success screen, cart clears on
      placement
- [x] Shared CrossSellGrid, ArtTile, RecolorGarment components reused across pages
- [ ] Drizzle schema + SanMar BulkData sync job (blocked on EDI Agreement)
- [ ] Design Studio: real upload handling + AI generation endpoint (currently simulated)
- [ ] Checkout: real order submission endpoint (currently just clears cart client-side)
- [ ] Recolorable garment PNGs (/public/images/t-shirt.png, hoodie.png) — needs actual
      transparent silhouette assets; falls back to an empty mask shape until then

## Images
Drop your images folder into /public/images using the SAME filenames referenced
in the original mockup (t-shirt_4.jpg, prod-hoodie.jpg, caps.jpg, etc.) —
components already reference these paths. Swap to real SanMar CDN URLs once
Media Content service access is live (next.config.ts already whitelists
media.sanmarcanada.com).

## Setup
npm install
npm run dev

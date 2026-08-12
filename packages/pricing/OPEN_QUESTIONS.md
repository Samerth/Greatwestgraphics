# Pricing engine — provisional open-question decisions

## v2 (`src/v2`) — decided in the Aug 2026 client review

1. **Rush** applies to production only; shipping is excluded (`settings.rushAppliesTo`).
2. **Dark garment premium** is a single editable surcharge on one base matrix, not a
   second pre-multiplied matrix. Dark means any colour except white.
3. **Digitizing and screen setup** are pass-through costs, so method multipliers
   never touch them (`setup.multiplierApplies: false`).
4. **Repeat artwork** pricing requires `artwork.verifiedByStaff`; a customer's
   unverified claim prices as new and raises `needsArtworkVerification`.
5. **Setup sharing** follows the workbook: once per logo group, split pro-rata by
   quantity across the garments using it.
6. **Rounding**: the unit price is rounded to the cent, then extended, so
   unit × quantity always equals the line total.
7. **Artwork minimum** carries over the v1 rule and still needs a client decision;
   set the fee to 0 to disable it. Tracked in `docs/PRICING_CONFIRMATION.md`.

## v1 (`src/calculate-quote.ts`)

Recorded so Test A–H pass and implementation can ship. Confirm with the project owner before changing behaviour.

1. **Artwork minimum ($30)** — applied once when there is new artwork, `designHours === 0`, and no screen-setup or digitizing fees were charged. (Otherwise Test A would include an extra $30.)
2. **Rush fee (20%)** — applied to the full subtotal including one-time fees, packing, and shipping (matches §3.2 step 4).
3. **Dark garment premium** — screen print only.
4. **Blank garment orders** — allowed (`decorations` may be empty).
5. **Per-method minimums** — not enforced in v1 beyond `settings.minimumOrderQty`.

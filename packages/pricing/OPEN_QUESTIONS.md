# Pricing engine — provisional open-question decisions

Recorded so Test A–H pass and implementation can ship. Confirm with the project owner before changing behaviour.

1. **Artwork minimum ($30)** — applied once when there is new artwork, `designHours === 0`, and no screen-setup or digitizing fees were charged. (Otherwise Test A would include an extra $30.)
2. **Rush fee (20%)** — applied to the full subtotal including one-time fees, packing, and shipping (matches §3.2 step 4).
3. **Dark garment premium** — screen print only.
4. **Blank garment orders** — allowed (`decorations` may be empty).
5. **Per-method minimums** — not enforced in v1 beyond `settings.minimumOrderQty`.

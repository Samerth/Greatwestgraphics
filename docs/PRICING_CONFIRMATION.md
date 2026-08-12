# Great West Graphics — Pricing confirmation

**Source:** `GWG Pricing Master Formula.xlsx`, imported 2026-08-11, plus the client pricing rules from the same date.

Every number below is produced by the live pricing engine (`@gwg/pricing`), not typed by hand. Re-run `node scripts/pricing-examples.mjs` to regenerate the worked examples, and `python3 scripts/import-pricing-master.py` to re-import the workbook.

Currency **CAD**. Tax is calculated separately and is not part of any subtotal here.

---

## 1. What is admin-editable

Everything in this table is a setting in the admin pricing screen. None of it requires a developer.

| Control | Current working value | Notes |
|---|---|---|
| Screen print multiplier | 1.00 | Applies to the run charge |
| Embroidery multiplier | 0.95 | Run charge only — never digitizing |
| DTF multiplier | 1.00 | |
| Garment markup multiplier | 1.00 | Applies on top of the markup grid |
| Dark garment premium | **+10%** | Screen print only |
| Screen setup — new artwork | **$35.00** per colour, per location | |
| Screen setup — repeat artwork | **$30.00** per colour, per location | Staff-verified only |
| Digitizing — new logo | **$65.00** per logo | Not multiplied |
| Digitizing — repeat logo | $0.00 | Staff-verified only |
| DTF minimum | **$40.00** per location | |
| Oversized location | **$1.50** per piece, per location | |
| Packing | **$0.75** per garment, optional | |
| Shipping | actual cost **+15%** | |
| Rush | **+30%** | Production only — **shipping is excluded** |
| Minimum order | 1 piece | |
| Quote validity | 30 days | |
| Margin warning | below 35% | Warns staff, does not block |

Rate tables (screen print by colour, embroidery, DTF, garment markup) are editable too, as is the list of decoration methods itself.

---

## 2. Artwork: new vs repeat, and who decides

Pricing depends on the **artwork**, not on whether the customer is new to us.

|  | Screen print setup | Embroidery digitizing |
|---|---|---|
| New artwork | $35 / colour / location | $65 per logo |
| Repeat artwork | $30 / colour / location | $0 |

**Customers cannot give themselves repeat pricing.** A customer may tick "I've ordered this artwork before", but the quote is priced at new-artwork rates and flagged for review until a staff member verifies it. The quote shows exactly why: *"Customer says this is repeat artwork, but staff have not verified it yet, so the new-artwork rate applies."*

**Shared logos.** One logo used on several garments is charged **once** and split across those garments pro-rata by quantity, matching the workbook. Example: one 2-colour logo ($70 setup) on 100 tees and 50 hoodies bills $46.67 to the tees and $23.33 to the hoodies.

---

## 3. How a price is built

1. **Garment** — vendor cost rounded up to the next whole dollar, read off the markup grid at the exact order quantity, times the garment multiplier.
2. **Each decoration location** — rate from that method's table, interpolated to the exact quantity, times the method multiplier, then the method's minimum charge if it applies.
3. **Surcharges** — dark garment (screen print, +10%) and oversized ($1.50/piece) appear as their own lines, never buried inside a rate.
4. **Setup / digitizing** — once per logo, split across garments by quantity.
5. **Packing** — optional, $0.75 per garment.
6. **Rush** — 30% of garments + decoration + setup + packing. **Not** shipping.
7. **Shipping** — actual freight + 15%.
8. **Tax** — handled outside the quote.

### Continuous pricing between quantity breaks

Prices no longer jump at tier boundaries. A tier rate is the price *at the first quantity of that tier*, and quantities in between are interpolated. At 36 pieces, a 3-colour print sits halfway between the 24-piece rate ($8.10) and the 48-piece rate ($6.60), so it prices at **$7.35** — not $8.10.

### Rounding

The unit price is rounded to the cent first, then multiplied by the quantity. That means **unit price × quantity always equals the line total** on the quote. The workbook extended unrounded unit prices, so our totals can differ from it by a few cents on large orders (19 cents on the workbook's own sample quote).

---

## 4. Rate tables as imported

### Screen print — per piece, before multiplier and dark premium

| Colours | 1–5 | 6–11 | 12–23 | 24–47 | 48–71 | 72–143 | 144–287 | 288–499 | 500–999 | 1000+ |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 22.00 | 13.00 | 8.50 | 5.50 | 4.60 | 4.00 | 3.55 | 3.10 | 2.75 | 2.45 |
| 2 | 25.00 | 15.50 | 10.50 | 6.80 | 5.60 | 4.95 | 4.45 | 3.85 | 3.40 | 3.00 |
| 3 | 28.00 | 18.00 | 12.50 | 8.10 | 6.60 | 5.90 | 5.35 | 4.60 | 4.05 | 3.55 |
| 4 | 31.00 | 20.50 | 14.50 | 9.40 | 7.60 | 6.85 | 6.25 | 5.35 | 4.70 | 4.10 |
| 5 | 34.00 | 23.00 | 16.50 | 10.70 | 8.60 | 7.80 | 7.15 | 6.10 | 5.35 | 4.65 |
| 6 | 37.00 | 25.50 | 18.50 | 12.00 | 9.60 | 8.75 | 8.05 | 6.85 | 6.00 | 5.20 |
| 7 | 40.00 | 28.00 | 20.50 | 13.30 | 10.60 | 9.70 | 8.95 | 7.60 | 6.65 | 5.75 |
| 8 | 43.00 | 30.50 | 22.50 | 14.60 | 11.60 | 10.65 | 9.85 | 8.35 | 7.30 | 6.30 |

Dark garments add 10% to this charge. **Dark means every colour except White**, to keep quoting simple.

### Embroidery — per piece

| Qty | Base (to 5,000 stitches) | Each extra 1,000 |
|---|---|---|
| 1–5 | 18.00 | 1.50 |
| 6–11 | 12.00 | 1.25 |
| 12–23 | 9.00 | 1.10 |
| 24–47 | 7.00 | 0.95 |
| 48–71 | 6.25 | 0.85 |
| 72–143 | 5.75 | 0.75 |
| 144–287 | 5.25 | 0.65 |
| 288+ | 4.75 | 0.55 |

Partial thousands are billed proportionally: 7,500 stitches bills 2.5 units, not 3.

### DTF — per piece

| Qty | Small | Medium | Large | Oversize |
|---|---|---|---|---|
| 1–5 | 8.00 | 11.00 | 15.00 | 20.00 |
| 6–11 | 6.50 | 9.00 | 12.50 | 17.00 |
| 12–23 | 5.50 | 7.50 | 10.50 | 14.50 |
| 24–47 | 4.50 | 6.25 | 8.75 | 12.00 |
| 48–71 | 4.00 | 5.50 | 7.75 | 10.50 |
| 72–143 | 3.60 | 5.00 | 7.00 | 9.50 |
| 144–287 | 3.25 | 4.50 | 6.25 | 8.50 |
| 288+ | 3.00 | 4.10 | 5.75 | 7.75 |

Minimum $40 per location.

### Garment markup

150 cost rows ($1–$150) × 10 quantity anchors, imported exactly from the workbook. Sample values:

| Vendor cost | Qty 1 | Qty 24 | Qty 72 | Qty 288 |
|---|---|---|---|---|
| $5 | 3.24× | 2.37× | 2.01× | 1.74× |
| $8 | 2.99× | 2.23× | 1.91× | 1.67× |
| $10 | 2.87× | 2.14× | 1.84× | 1.61× |
| $20 | 2.34× | 1.81× | 1.60× | 1.43× |

**This same grid prices catalog blanks.** There is no separate cost × 2.0 catalog markup any more. Because a catalog tile has no quantity, the displayed "from" price uses an admin-set display quantity, currently **24**.

---

## 5. Worked examples

Generated by the engine on 2026-08-11. Multipliers at their current working values.

### 1 piece, new 1-colour screen print, white tee ($10 cost)

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment | 1 | $28.70 | $28.70 |
| Screen print · front | 1 | $22.00 | $22.00 |
| Screen setup · front | 1 | $35.00 | $35.00 |
| **Total** | | | **$85.70** |

### 24 pieces, new 3-colour screen print, white tee ($8 cost)

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment | 24 | $17.84 | $428.16 |
| Screen print · front | 24 | $8.10 | $194.40 |
| Screen setup · front | 1 | $105.00 | $105.00 |
| **Total** | | | **$727.56** |

### Same job, verified repeat artwork

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment + print | | | $622.56 |
| Screen setup · front | 1 | $90.00 | $90.00 |
| **Total** | | | **$712.56** |

### Same job on a navy tee (dark premium)

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment | 24 | $17.84 | $428.16 |
| Screen print · front | 24 | $8.10 | $194.40 |
| Dark garment · front | 24 | $0.81 | $19.44 |
| Screen setup · front | 1 | $105.00 | $105.00 |
| **Total** | | | **$747.00** |

### 36 pieces, new 3-colour screen print — interpolation in action

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment | 36 | $17.20 | $619.20 |
| Screen print · front | 36 | $7.35 | $264.60 |
| Screen setup · front | 1 | $105.00 | $105.00 |
| **Total** | | | **$988.80** |

### 48 caps, embroidery 8,000 stitches, new logo ($5 cost)

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Cap | 48 | $10.90 | $523.20 |
| Embroidery · front | 48 | $8.36 | $401.28 |
| Digitizing · front | 1 | $65.00 | $65.00 |
| **Total** | | | **$989.48** |

Reorder with the same verified logo: **$924.48** (no digitizing).

### 1 piece, medium DTF — minimum charge

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment | 1 | $28.70 | $28.70 |
| DTF transfer · front | 1 | $40.00 | $40.00 |
| Artwork minimum | 1 | $30.00 | $30.00 |
| **Total** | | | **$98.70** |

The $11.00 rate × 1 piece is below the $40 minimum, so the minimum is charged. The artwork minimum also lands here because DTF has no setup fee — see the open questions below.

### 24 pieces, three methods on one garment

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Garment | 24 | $17.84 | $428.16 |
| Embroidery · left chest | 24 | $6.65 | $159.60 |
| DTF transfer · back | 24 | $6.25 | $150.00 |
| Screen print · sleeve | 24 | $5.50 | $132.00 |
| Digitizing · left chest | 1 | $65.00 | $65.00 |
| Screen setup · sleeve | 1 | $35.00 | $35.00 |
| **Total** | | | **$969.76** |

### Shared logo on two garments, rush and shipping

100 tees ($8 cost) and 50 hoodies ($20 cost), one 2-colour logo on both, rush, packing, $60 freight.

| Line | Qty | Unit | Amount |
|---|---|---|---|
| Tee | 100 | $14.80 | $1,480.00 |
| Hoodie | 50 | $33.80 | $1,690.00 |
| Screen print · front (tee) | 100 | $4.76 | $476.00 |
| Screen print · front (hoodie) | 50 | $5.55 | $277.50 |
| Screen setup · shared (tee) | 1 | $46.67 | $46.67 |
| Screen setup · shared (hoodie) | 1 | $23.33 | $23.33 |
| Individual packing | 150 | $0.75 | $112.50 |
| Shipping | 1 | $69.00 | $69.00 |
| Rush (30%) | 1 | $1,231.80 | $1,231.80 |
| **Total** | | | **$5,406.80** |

Rush is 30% of $4,105.99 of production — the $69.00 shipping line is excluded.

---

## 6. Nothing is hidden

Every line on every quote carries its own explanation, produced by the pricing engine itself. Staff see, for each amount: what it is in plain English, the steps that produced it, and which admin setting each step came from. For example, a 36-piece print shows the two tier rates it sits between, the interpolation arithmetic, the multiplier, and a link to the exact rate cell.

The same data drives the customer-facing quote at a lower level of detail, so the two can never disagree.

### Where each rule is edited

Staff pricing lives at **/admin/pricing/v2**. Nothing entered there reaches a customer until it is published, and every publish is kept so an old quote can always be re-priced with the numbers that produced it.

| Tab | What it controls |
|---|---|
| Calculator | Price any hypothetical order against the settings currently on screen, including unsaved edits. Each line expands to show the arithmetic and the settings it came from, and the result can be compared side by side against the published version. |
| Garments | The cost x quantity markup grid, the cost cap, whether cost rounds up to the whole dollar, MAP handling, and the quantity the storefront's "from" price assumes. Includes a lookup that shows which grid cell a given cost and quantity uses. |
| Decoration | Per method: run rates by quantity, setup and artwork fees, surcharges, minimum charge, the method multiplier, and whether repeat artwork needs staff verification. New methods can be added here without a code change. |
| Order rules | Minimum order, quote validity, rush percentage and what it applies to, packing, shipping markup, artwork minimum, design rate, the dark garment rule, and the margin warning threshold. |
| History | Every published version with its note, and a one-click copy of any version back into the draft. |

---

## 7. Open questions

1. **Artwork minimum ($30).** It currently applies once when there is new artwork but no setup or digitizing fee was charged — which in practice means DTF-only and blank orders. Keep, change, or set to $0? *(To discuss on the call.)*
2. **Design time ($75/hr).** Not yet exposed anywhere in the quote flow. *(To discuss on the call.)*
3. **MAP.** Currently set to warn staff when a calculated price falls below a vendor's minimum advertised price, without changing the price. The alternatives are to treat MAP as a hard floor, or ignore it. *(To discuss.)*
4. **Shared logos and quantity breaks.** When one logo runs on 100 tees and 50 hoodies, each garment currently gets the rate for its own quantity ($4.76 and $5.55), matching the workbook. Should a shared logo instead price at the *combined* 150-piece rate, since it is one press run?
5. **Sample / blank returns.** Blank-only orders are for samples with a return window — the duration and the customer-facing wording still need to be set.
6. **Quote validity.** Defaulted to 30 days. Confirm 15 or 30.

---

## 8. Known differences from the workbook

These are deliberate, and all of them favour the newer rules you gave us:

| Area | Workbook | System |
|---|---|---|
| New artwork setup | $30 (same as repeat) | **$35** |
| Rush base | includes shipping | **excludes shipping** |
| Digitizing | $61.75 (multiplier applied) | **$65 flat** |
| Digitizing on 2nd+ line | $30 (references the artwork minimum cell — a bug) | **$65 per logo, once** |
| Dark garments | second pre-rounded matrix | one matrix + editable 10% premium (differs by ~0.2¢/piece) |
| Repeat artwork | one quote-wide toggle | per logo, staff-verified |
| Minimum order, design rate, oversized surcharge | present but not wired to anything | live |
| Line totals | unrounded unit × qty | rounded unit × qty, so quotes reconcile |

---

## 9. Sign-off

| | |
|---|---|
| Reviewed by | ______________________ |
| Date | ______________________ |
| Changes requested | ______________________ |

/**
 * Prints the worked examples used in docs/PRICING_CONFIRMATION.md straight from
 * the pricing engine, so the document can never quote a number the system
 * wouldn't actually charge.
 *
 * Usage: node scripts/pricing-examples.mjs
 */
import { calculateQuoteV2, PRICING_MASTER_V2 } from "@gwg/pricing";

const config = PRICING_MASTER_V2;
const money = (minor) => `$${(minor / 100).toFixed(2)}`;

const garment = (over = {}) => ({
  id: "g1",
  description: "Garment",
  unitCostMinor: 800,
  quantity: 24,
  colourName: "White",
  ...over,
});

const decoration = (over = {}) => ({
  id: "d1",
  garmentId: "g1",
  methodKey: "screenPrint",
  location: "front",
  logoGroup: "",
  isOversized: false,
  artwork: { isRepeat: false, verifiedByStaff: false },
  ...over,
});

const options = (over = {}) => ({
  rush: false,
  includePacking: false,
  shippingCostMinor: 0,
  designHours: 0,
  ...over,
});

const examples = [
  {
    title: "1 piece, new 1-colour screen print, white tee",
    input: {
      garments: [garment({ unitCostMinor: 1000, quantity: 1 })],
      decorations: [decoration({ colours: 1 })],
      options: options(),
    },
  },
  {
    title: "24 pieces, new 3-colour screen print, white tee",
    input: {
      garments: [garment({ quantity: 24 })],
      decorations: [decoration({ colours: 3 })],
      options: options(),
    },
  },
  {
    title: "36 pieces, new 3-colour screen print (interpolated quantity)",
    input: {
      garments: [garment({ quantity: 36 })],
      decorations: [decoration({ colours: 3 })],
      options: options(),
    },
  },
  {
    title: "24 pieces, same job on a navy tee (dark premium)",
    input: {
      garments: [garment({ quantity: 24, colourName: "Navy" })],
      decorations: [decoration({ colours: 3 })],
      options: options(),
    },
  },
  {
    title: "24 pieces, verified repeat artwork",
    input: {
      garments: [garment({ quantity: 24 })],
      decorations: [
        decoration({
          colours: 3,
          artwork: { isRepeat: true, verifiedByStaff: true, verifiedBy: "Kevin" },
        }),
      ],
      options: options(),
    },
  },
  {
    title: "48 caps, embroidery 8,000 stitches, new logo",
    input: {
      garments: [
        garment({ unitCostMinor: 500, quantity: 48, colourName: "Black", description: "Cap" }),
      ],
      decorations: [
        decoration({ methodKey: "embroidery", variableValue: 8000, logoGroup: "acme" }),
      ],
      options: options(),
    },
  },
  {
    title: "48 caps, same logo on a reorder (verified repeat)",
    input: {
      garments: [
        garment({ unitCostMinor: 500, quantity: 48, colourName: "Black", description: "Cap" }),
      ],
      decorations: [
        decoration({
          methodKey: "embroidery",
          variableValue: 8000,
          logoGroup: "acme",
          artwork: { isRepeat: true, verifiedByStaff: true, verifiedBy: "Kevin" },
        }),
      ],
      options: options(),
    },
  },
  {
    title: "1 piece DTF medium (minimum charge applies)",
    input: {
      garments: [garment({ unitCostMinor: 1000, quantity: 1 })],
      decorations: [decoration({ methodKey: "dtf", optionKey: "medium" })],
      options: options(),
    },
  },
  {
    title: "24 pieces, three methods on one garment",
    input: {
      garments: [garment({ quantity: 24 })],
      decorations: [
        decoration({
          id: "d1",
          methodKey: "embroidery",
          location: "left chest",
          variableValue: 5000,
          logoGroup: "acme",
        }),
        decoration({ id: "d2", methodKey: "dtf", location: "back", optionKey: "medium" }),
        decoration({ id: "d3", methodKey: "screenPrint", location: "sleeve", colours: 1 }),
      ],
      options: options(),
    },
  },
  {
    title: "Shared logo across two garments, rush and shipping",
    input: {
      garments: [
        garment({ id: "g1", description: "Tee", unitCostMinor: 800, quantity: 100 }),
        garment({ id: "g2", description: "Hoodie", unitCostMinor: 2000, quantity: 50 }),
      ],
      decorations: [
        decoration({ id: "d1", garmentId: "g1", colours: 2, logoGroup: "west" }),
        decoration({ id: "d2", garmentId: "g2", colours: 2, logoGroup: "west" }),
      ],
      options: options({ rush: true, includePacking: true, shippingCostMinor: 6000 }),
    },
  },
];

for (const example of examples) {
  const result = calculateQuoteV2(example.input, config);
  console.log(`\n### ${example.title}`);
  console.log("| Line | Qty | Unit | Amount |");
  console.log("|------|-----|------|--------|");
  for (const line of result.lines) {
    console.log(
      `| ${line.label} | ${line.quantity} | ${money(line.unitAmountMinor)} | ${money(line.extendedAmountMinor)} |`,
    );
  }
  console.log(`| **Total** | | | **${money(result.totals.totalMinor)}** |`);
  for (const g of result.garments) {
    console.log(
      `- Garment ${g.garmentId}: ${money(g.unitPriceMinor)} per piece (${money(g.sellPerPieceMinor)} garment + ${money(g.decorationPerPieceMinor)} decoration)`,
    );
  }
  console.log(
    `- Margin: ${(result.totals.grossMarginPercent * 100).toFixed(1)}% · warnings: ${result.warnings.length ? result.warnings.join(" ") : "none"}`,
  );
}

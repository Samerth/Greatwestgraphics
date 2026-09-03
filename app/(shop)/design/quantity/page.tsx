import type { Metadata } from "next";
import { Container } from "@/components/shared/Container";
import { QuantityStep } from "@/components/design/QuantityStep";
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";

// The design being priced lives in the visitor's own browser storage, so
// there is nothing here worth caching between people.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Input Quantity — Choose Colours & Sizes",
  description:
    "Choose the garment colours you want your design printed on and enter quantities by size. See your per-piece price update as you go.",
  alternates: { canonical: "/design/quantity" },
  // Step 2 of a flow is meaningless without the design that precedes it.
  robots: { index: false, follow: true },
};

export default async function DesignQuantityPage() {
  const pricingConfig = await loadPublishedPricingV2();

  return (
    <Container>
      <QuantityStep pricingConfig={pricingConfig} />
    </Container>
  );
}

import type { Metadata } from "next";
import ShippingPage from "../shipping/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = contentMetadata("/shipping-delivery");

export default ShippingPage;

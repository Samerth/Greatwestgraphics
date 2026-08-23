import type { Metadata } from "next";
import ProductsPage from "../products/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = contentMetadata("/catalogue");

export default ProductsPage;

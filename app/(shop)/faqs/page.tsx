import type { Metadata } from "next";
import FaqPage from "../faq/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = contentMetadata("/faqs");

export default FaqPage;

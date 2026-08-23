import type { Metadata } from "next";
import QuotePage from "../quote/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = contentMetadata("/get-a-quote");

export default QuotePage;

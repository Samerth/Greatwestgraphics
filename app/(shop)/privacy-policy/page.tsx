import type { Metadata } from "next";
import PrivacyPage from "../privacy/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = contentMetadata("/privacy-policy");

export default PrivacyPage;

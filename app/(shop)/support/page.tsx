import type { Metadata } from "next";
import ContactPage from "../contact/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = contentMetadata("/support");

export default ContactPage;

import type { Metadata } from "next";
import AboutPage from "../about/page";
import { contentMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = contentMetadata("/about-us-great-west-graphics");

export default AboutPage;

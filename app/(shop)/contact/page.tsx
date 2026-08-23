import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Talk to the Great West Graphics print floor in Vancouver. Share your product, quantity and deadline and a specialist will help you plan the job.",
  alternates: { canonical: "/contact-us" },
};

export default function ContactPage() {
  return <ContactForm />;
}

import { redirect } from "next/navigation";

export default function PortalPricingRedirect() {
  redirect("/admin/pricing");
}

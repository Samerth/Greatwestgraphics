import { adminToken } from "@/lib/admin/auth";
import { createCommerceClient } from "@/lib/commerce/client";

export async function adminClient() {
  return createCommerceClient();
}

export function requireAdminToken() {
  return adminToken();
}

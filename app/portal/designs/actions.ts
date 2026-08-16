"use server";

import { revalidatePath } from "next/cache";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";

export async function deleteDesignAction(id: string) {
  // The commerce API scopes the delete to the acting person, so this is not the
  // only thing standing between a caller and someone else's design — but an
  // unauthenticated caller reached it and got a confusing failure from the API
  // rather than being told to sign in.
  const session = await getCustomerSession();
  if (!session) {
    throw new Error("Sign in to delete a design");
  }
  await (await createCommerceClient()).deleteDesignProject(id);
  revalidatePath("/portal/designs");
}

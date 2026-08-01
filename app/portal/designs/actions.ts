"use server";

import { revalidatePath } from "next/cache";
import { createCommerceClient } from "@/lib/commerce/client";

export async function deleteDesignAction(id: string) {
  await (await createCommerceClient()).deleteDesignProject(id);
  revalidatePath("/portal/designs");
}

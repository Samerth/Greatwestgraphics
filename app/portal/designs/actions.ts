"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export async function deleteDesignAction(id: string) {
  // The commerce API scopes the delete to the acting person, so this is not the
  // only thing standing between a caller and someone else's design — but an
  // unauthenticated caller reached it and got a confusing failure from the API
  // rather than being told to sign in.
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/portal/designs");
  }

  // A failure here used to throw straight into the portal's error boundary,
  // so a design that could not be deleted — for any reason at all — replaced
  // the whole page with "Something went wrong" and no clue why. It now lands
  // back on the list with the actual reason, which is also what makes the
  // cause diagnosable when it happens to a customer (found 15 Sep).
  let message: string | null = null;
  try {
    await (await createCommerceClient()).deleteDesignProject(id);
  } catch (caught) {
    console.error("[portal] delete design failed", { id, caught });
    message =
      caught instanceof CommerceApiError
        ? caught.message
        : "This design could not be deleted. Please try again.";
  }
  revalidatePath("/portal/designs");
  if (message) {
    redirect(`/portal/designs?error=${encodeURIComponent(message)}`);
  }
}

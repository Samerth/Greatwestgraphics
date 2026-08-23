export function storeFrontPath(slug: string): string {
  return `/s/${slug}`;
}

export function storeFrontUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}${storeFrontPath(slug)}`;
}

/**
 * Mail sent to the corporate owner after staff approve the store.
 * The live address is `/s/{slug}` on this site — there is no DNS for
 * `{slug}.greatwestgraphics.com` yet.
 */
export function buildStoreApprovedEmail(input: {
  storeName: string;
  slug: string;
  origin: string;
  ownerName?: string | null;
}): { subject: string; text: string } {
  const link = storeFrontUrl(input.origin, input.slug);
  const greeting = input.ownerName?.trim()
    ? `Hi ${input.ownerName.trim()},`
    : "Hello,";
  return {
    subject: `${input.storeName} is live on Great West Graphics`,
    text: [
      greeting,
      "",
      `Your store ${input.storeName} has been approved and is ready for orders.`,
      "",
      `Open it here: ${link}`,
      "",
      "Sign in with the email you used to create the store. Invite colleagues from Store & team access once you are in.",
    ].join("\n"),
  };
}

export function publicSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
}

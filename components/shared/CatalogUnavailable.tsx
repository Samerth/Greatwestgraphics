import { ButtonLink } from "@/components/shared/Button";

/**
 * Shown when the commerce API call itself failed, as distinct from a search
 * that legitimately matched nothing.
 *
 * This replaced a fallback that rendered twelve hardcoded demo products at
 * invented prices. During an outage a shopper saw a catalogue that looked
 * real, priced items that do not exist, and followed links to product pages
 * that were themselves demo fixtures. Telling someone the truth and handing
 * them a phone number costs us one browsing session; quoting them $9.20 on a
 * product we cannot sell costs us the order and the trust.
 */
export function CatalogUnavailable({
  /** Where "Try again" points. Defaults to the plain catalogue listing. */
  retryHref = "/products",
  title = "Our catalogue is temporarily unavailable",
}: {
  retryHref?: string;
  title?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-raised px-sp-5 py-sp-8 text-center">
      <p className="font-display font-bold text-[19px] mb-sp-2">{title}</p>
      <p className="text-text-secondary max-w-[52ch] mx-auto mb-sp-5">
        We can&apos;t load live product data at the moment. This is a problem on
        our end, not with your order — the shop is open, and we can still quote
        and print anything in our range while we sort it out.
      </p>
      <div className="flex flex-wrap gap-2.5 justify-center">
        <ButtonLink href={retryHref} variant="secondary">
          Try again
        </ButtonLink>
        <ButtonLink href="/quote" variant="primary">
          Request a Quote
        </ButtonLink>
        <ButtonLink href="/contact" variant="secondary">
          Contact Us
        </ButtonLink>
      </div>
      <p className="text-[13px] text-text-tertiary mt-sp-5 mb-0">
        Prefer to talk it through?{" "}
        <a href="tel:+16043213285" className="font-bold underline">
          (604) 321-3285
        </a>
        , Monday to Friday, 8:30am&ndash;4:30pm PST.
      </p>
    </div>
  );
}

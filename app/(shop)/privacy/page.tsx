import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/Container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Great West Graphics collects when you request a quote, save a design or create an account, why we hold it, who processes it, and how to ask for a copy or its deletion.",
  alternates: { canonical: "/privacy-policy" },
};

/**
 * The footer has always advertised a Privacy Policy, but the link pointed at
 * /shipping#privacy — an anchor that does not exist on that page, so it landed
 * on shipping copy with no privacy content anywhere on the site. Every
 * statement below is drawn from what the code actually does today (see
 * app/api/contact/route.ts, app/api/uploads/route.ts, lib/auth/session.ts and
 * lib/store/cart.ts) rather than from a template, so it should be accurate as
 * written. It still needs a lawyer's read before launch, and the retention
 * period in particular is a business decision that has not been made.
 */
const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "What we collect, and when",
    body: (
      <>
        <p>
          We only ask for what a print job needs. Depending on what you do on
          this site, that is:
        </p>
        <ul className="mt-sp-2 space-y-1.5 text-text-secondary">
          <li>
            <b>Contact and quote requests.</b> Your name, email address, and
            optionally your phone number, company and the details of what you
            want made.
          </li>
          <li>
            <b>Account sign-in.</b> Your email address, which we verify with a
            one-time code, plus your name if you give it.
          </li>
          <li>
            <b>Orders and proofs.</b> The garments, quantities and decoration
            you chose, your delivery or pickup address, and any notes you send
            our studio. For team or roster orders, the names and numbers you
            enter for each garment.
          </li>
          <li>
            <b>Artwork.</b> Logo and design files you upload, and designs you
            save in the Design Studio.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: "What stays in your browser",
    body: (
      <p>
        Your cart is stored in your own browser, not on our servers, and we do
        not see it until you submit a request. Signing in sets a session cookie
        so you stay signed in between pages. We do not run advertising or
        cross-site tracking cookies on this site.
      </p>
    ),
  },
  {
    heading: "Why we hold it",
    body: (
      <p>
        To quote your job, produce a proof for your approval, print and ship the
        order, answer you when you get in touch, and keep your artwork and specs
        on file so a reorder does not need new setup. We do not sell your
        personal information, and we do not use it to advertise to you.
      </p>
    ),
  },
  {
    heading: "Who else processes it",
    body: (
      <>
        <p>
          We use a small number of service providers, and only for the purposes
          above:
        </p>
        <ul className="mt-sp-2 space-y-1.5 text-text-secondary">
          <li>
            <b>Amazon Web Services</b> — hosting, our database, and storage for
            uploaded artwork. Our infrastructure runs in AWS&apos;s Canadian
            region.
          </li>
          <li>
            <b>Resend</b> — sending transactional email such as sign-in codes,
            proof notifications and contact-form messages.
          </li>
        </ul>
        <p className="mt-sp-3">
          We may also share order details with a blank supplier or courier where
          that is what it takes to fulfil your order.
        </p>
      </>
    ),
  },
  {
    heading: "Payment information",
    body: (
      <p>
        This site does not take card numbers. Checkout submits your job for
        design review; when pricing is final we send a secure invoice and the
        payment is handled by the payment processor on that invoice. Card
        details are never entered on, or stored by, this website.
      </p>
    ),
  },
  {
    heading: "How long we keep it",
    body: (
      <p>
        Order records and artwork are kept while your account is active so that
        reorders stay easy, and after that for as long as we need them to meet
        our tax and business record-keeping obligations. Ask us and we will tell
        you what we hold for you.
      </p>
    ),
  },
  {
    heading: "Your choices",
    body: (
      <p>
        You can ask for a copy of the personal information we hold about you,
        ask us to correct it, or ask us to delete it — including saved designs,
        which you can also delete yourself from{" "}
        <Link href="/portal/designs" className="text-accent font-bold hover:underline">
          My Designs
        </Link>
        . Email us and we will respond. If you are not satisfied with how we
        have handled a request, you can contact the Office of the Privacy
        Commissioner of Canada.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section id="privacy" className="py-sp-8 border-b border-border scroll-mt-28">
        <Container>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Privacy
          </span>
          <h1 className="font-display font-bold text-display leading-display mt-sp-2 max-w-[20ch]">
            What we collect, and why.
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[64ch]">
            Great West Graphics is a Vancouver print and embroidery shop. We
            collect the details a print job actually needs — nothing is sold, and
            nothing is used to advertise to you.
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container className="max-w-[76ch] space-y-sp-6">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <h2 className="font-display text-header font-bold mb-sp-2">
                {section.heading}
              </h2>
              <div className="text-text-secondary space-y-sp-2">
                {section.body}
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-border bg-bg-raised p-sp-5">
            <h2 className="font-display text-lg font-bold m-0">
              Questions about your information
            </h2>
            <p className="text-sm text-text-secondary mt-sp-2 mb-0">
              #105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6
              <br />
              <a
                href="mailto:info@greatwestgraphics.com"
                className="text-accent font-bold hover:underline"
              >
                info@greatwestgraphics.com
              </a>{" "}
              ·{" "}
              <a href="tel:+16043213285" className="text-accent font-bold hover:underline">
                (604) 321-3285
              </a>
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}

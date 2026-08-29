import Link from "next/link";
import { AccountAuth } from "@/components/account/AccountAuth";
import { BackToSite } from "@/components/shared/BackToSite";
import { Container } from "@/components/shared/Container";
import { isLocalCustomerAuthEnabled } from "@/lib/auth/local-customer";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";
import { destinationAfterSignIn } from "@/lib/commerce/membership";
import { backToSiteHref } from "@/lib/navigation/back-to-site";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getCustomerSession();
  if (session) {
    let memberships: Awaited<
      ReturnType<Awaited<ReturnType<typeof createCommerceClient>>["listMyMemberships"]>
    > = [];
    try {
      memberships = await (
        await createCommerceClient()
      ).listMyMemberships(session.personId);
    } catch {
      // Fall through to destinationAfterSignIn with an empty list.
    }
    redirect(destinationAfterSignIn(next, memberships));
  }

  return (
    <div className="grid lg:grid-cols-[minmax(320px,560px)_1fr] min-h-[70vh]">
      <section className="flex flex-col justify-center px-sp-5 sm:px-sp-7 py-sp-8">
        <Container className="max-w-xl !px-0">
          <BackToSite
            href={backToSiteHref(next)}
            label={
              next?.startsWith("/s/") ? "Back to store" : "Continue shopping"
            }
          />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent m-0">
            {next?.startsWith("/start") ? "Corporate & institutional" : "Customer login"}
          </p>
          <h1 className="font-display font-bold text-[clamp(1.75rem,3vw,2.5rem)] leading-tight mt-2 mb-sp-2 max-w-[16ch]">
            {next?.startsWith("/start")
              ? "Sign in to your company store"
              : "Sign In to Your Account"}
          </h1>
          <p className="text-sm text-text-secondary mb-sp-5 max-w-[42ch]">
            {next?.startsWith("/start")
              ? "Use the email you registered the store with. If this is your first time, create an account, name the store, and staff will open it."
              : "Orders, saved artwork, and your team store live in the customer portal after you sign in."}{" "}
            Staff use{" "}
            <Link href="/admin/login" className="font-bold text-accent hover:underline">
              Staff Login
            </Link>
            .
          </p>
          <AccountAuth
            next={next}
            localDev={isLocalCustomerAuthEnabled()}
          />
        </Container>
      </section>

      <aside className="relative hidden lg:block min-h-[640px] overflow-hidden bg-[linear-gradient(155deg,var(--color-accent)_0%,#0b1f4a_48%,#0D0D0D_100%)] text-white">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/images/login_hero.mp4"
          poster="/images/hero-press.jpg"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 40%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-sp-7">
          <p className="m-0 text-xs font-bold tracking-[0.16em] uppercase text-white/75">
            Vancouver · Est. 1980 · Screen Printing &amp; Embroidery
          </p>
          <h2 className="font-display font-bold text-[clamp(1.75rem,2.6vw,2.5rem)] leading-tight m-0 mt-2 max-w-[18ch]">
            Design &amp; Print Your Custom Apparel
          </h2>
          <p className="m-0 mt-3 max-w-[48ch] text-white/80 text-sm leading-relaxed">
            Upload your art or design from scratch, preview a real mockup, and
            order — all before you talk to a rep.
          </p>
          <p className="m-0 mt-4 text-sm font-bold text-white/85">
            Proofed before every print run, since 1980.
          </p>
        </div>
      </aside>
    </div>
  );
}

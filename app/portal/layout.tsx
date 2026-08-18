import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { SignOutButton } from "@/components/account/SignOutButton";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";

/**
 * Whether this person belongs to a company store, and so has a team to manage.
 *
 * Not simply "has a membership": every retail shopper holds one on the
 * operator's own shop the moment they sign in, so that test would offer a team
 * page to someone who has only ever bought a hoodie.
 */
async function hasTeam(): Promise<boolean> {
  try {
    const session = await getCustomerSession();
    if (!session) return false;
    const memberships = await (
      await createCommerceClient()
    ).listMyMemberships(session.personId);
    return memberships.some((m) => !m.storeIsPublic);
  } catch {
    return false;
  }
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The team page was reachable only by typing its address: nothing in the
  // product linked to it. An owner could create a store and then had no way
  // to invite anyone into it.
  const showTeam = await hasTeam();

  return (
    <div>
      <div className="border-b border-border bg-bg-raised">
        <Container>
          <nav className="flex items-center gap-sp-4 py-sp-3 text-sm font-bold">
            <Link href="/" className="text-text-tertiary hover:text-text-primary">
              ← Store
            </Link>
            <span className="w-px h-4 bg-border" />
            <Link href="/portal" className="hover:text-accent">
              Overview
            </Link>
            <Link href="/portal/jobs" className="hover:text-accent">
              Jobs
            </Link>
            <Link href="/portal/designs" className="hover:text-accent">
              My Designs
            </Link>
            {showTeam && (
              <Link href="/account/team" className="hover:text-accent">
                Your Team
              </Link>
            )}
            <span className="flex-1" />
            <SignOutButton className="text-text-tertiary hover:text-accent" />
          </nav>
        </Container>
      </div>
      {children}
    </div>
  );
}

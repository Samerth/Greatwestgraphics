import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { SignOutButton } from "@/components/account/SignOutButton";
import { resolvePortalScope } from "@/lib/commerce/portal-client";
import { teamMemberships } from "@/lib/commerce/membership";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The team page was reachable only by typing its address: nothing in the
  // product linked to it. An owner could create a store and then had no way
  // to invite anyone into it.
  const scope = await resolvePortalScope();
  const showTeam = teamMemberships(scope.memberships).length > 0;
  const storeHref = scope.usingTeam ? `/s/${scope.store.slug}` : "/";

  return (
    <div>
      <div className="border-b border-border bg-bg-raised">
        <Container>
          <nav className="flex items-center gap-sp-4 py-sp-3 text-sm font-bold">
            <Link href={storeHref} className="text-text-tertiary hover:text-text-primary">
              ← {scope.usingTeam ? scope.store.name : "Store"}
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

import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { SignOutButton } from "@/components/account/SignOutButton";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <span className="flex-1" />
            <SignOutButton className="text-text-tertiary hover:text-accent" />
          </nav>
        </Container>
      </div>
      {children}
    </div>
  );
}

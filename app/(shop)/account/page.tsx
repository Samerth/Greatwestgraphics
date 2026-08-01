import { Container } from "@/components/shared/Container";
import { AccountAuth } from "@/components/account/AccountAuth";
import { getCustomerSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getCustomerSession();
  if (session) {
    redirect(next || "/portal/jobs");
  }

  return (
    <section className="py-sp-8">
      <Container className="max-w-xl">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Your account
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-5">
          Sign in to Great West Graphics
        </h1>
        <AccountAuth next={next} />
      </Container>
    </section>
  );
}

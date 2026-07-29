import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffSession } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  return (
    <AdminShell username={session?.username}>{children}</AdminShell>
  );
}

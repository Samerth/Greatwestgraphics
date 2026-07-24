import { TickBar } from "@/components/layout/TickBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TickBar />
      <Header />

      <main>{children}</main>

      <Footer />

      <ThemeToggle />
    </>
  );
}
import type { Metadata } from "next";

// page.tsx here is a client component ("use client"), which cannot export
// its own `metadata` — Next only reads that export from a server component.
// This layout exists solely to give the route a title of its own; it was
// untitled and read the homepage's (audit: "Ten routes share the home
// page's title").
export const metadata: Metadata = { title: "Cart" };

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}

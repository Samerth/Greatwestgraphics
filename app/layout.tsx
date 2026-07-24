import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Great West Graphics · Vancouver Screen Printing & Embroidery",
  description:
    "Vancouver screen printing and embroidery studio. Ink, thread and 45 years of getting it right, proofed before a single sheet runs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="orange"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable}`}
    >
      <body className="font-body text-body">{children}</body>
    </html>
  );
}

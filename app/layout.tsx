import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted rather than next/font/google: fetching these at build time made
// `docker build` depend on fonts.gstatic.com, which already failed a CI image
// build. Both are variable fonts, so one latin file covers weights 400-700.
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin-variable.woff2",
  weight: "400 700",
  variable: "--font-display",
  display: "swap",
});

const ibmPlexSans = localFont({
  src: "./fonts/ibm-plex-sans-latin-variable.woff2",
  weight: "400 700",
  variable: "--font-body",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Great West Graphics";
const DEFAULT_TITLE =
  "Great West Graphics · Vancouver Screen Printing & Embroidery";
const DEFAULT_DESCRIPTION =
  "Vancouver screen printing and embroidery studio since 1980. Ink, thread and four decades of getting it right, proofed before a single sheet runs.";
const DEFAULT_OG_IMAGE = "/images/hero-press.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · Great West Graphics",
  },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    images: [{ url: DEFAULT_OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="blue"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('gwg-theme');if(t==='orange'||t==='blue'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body text-body">{children}</body>
    </html>
  );
}

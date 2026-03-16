import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const bodyFont = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Relationship Memory Time Machine",
  description: "A curated story and insight experience built from a long-form WhatsApp conversation archive.",
};

const NAV_ITEMS = [
  { href: "/" as Route, label: "Story" },
  { href: "/dashboard/" as Route, label: "Dashboard" },
  { href: "/timeline/" as Route, label: "Timeline" },
  { href: "/moments/" as Route, label: "Moments" },
  { href: "/themes/" as Route, label: "Themes" },
  { href: "/patterns/" as Route, label: "Patterns" },
] as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        {/* Soft Noise Texture Overlay for Editorial Print Feel */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.04 }}>
          <svg style={{ width: '100%', height: '100%' }}>
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" />
          </svg>
        </div>

        <div className="page-shell">
          <header className="site-header">
            <Link href="/" className="brand-mark" prefetch={false}>
              Relationship Memory Time Machine
            </Link>
            <nav className="site-nav">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

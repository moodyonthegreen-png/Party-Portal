import type { Metadata, Viewport } from "next";
import { themeFontVars } from "@/lib/fonts";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "Elebrate by Moody Celebrations", template: "%s · Elebrate" },
  description: "Elebrate: virtual showers and celebrations. Join the party, sign the guest book and celebrate from anywhere.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f3ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={themeFontVars}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { themeFontVars } from "@/lib/fonts";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "Moody Celebrations Party Portal", template: "%s · Moody Celebrations" },
  description: "Join the party, add your design, and celebrate from anywhere.",
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

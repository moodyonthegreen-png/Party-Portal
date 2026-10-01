import { Allura, Cormorant_Garamond, EB_Garamond } from "next/font/google";

// Theme fonts. Every theme's CSS picks from these variables.
const allura = Allura({ subsets: ["latin"], weight: "400", variable: "--font-allura", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-ebgaramond", display: "swap" });

/** Class names that make the theme font variables available. */
export const themeFontVars = `${allura.variable} ${cormorant.variable} ${ebGaramond.variable}`;

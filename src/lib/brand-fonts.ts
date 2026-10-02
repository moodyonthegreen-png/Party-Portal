import { Allura, Roboto_Condensed } from "next/font/google";

/** Moody Celebrations brand type: Allura (script) and Roboto Condensed. */
const allura = Allura({ subsets: ["latin"], weight: "400", variable: "--font-allura", display: "swap" });
const robotoCondensed = Roboto_Condensed({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto-condensed", display: "swap" });

export const brandFontVars = `${allura.variable} ${robotoCondensed.variable}`;

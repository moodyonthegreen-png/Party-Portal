import { Instrument_Sans, Instrument_Serif } from "next/font/google";

/**
 * The house type: Instrument Serif for names and titles, Instrument Sans for
 * everything people read and tap. Loaded once in the root layout; party pages
 * still add `themeFontVars` so a theme could bring its own pairing later.
 */
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});
export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-instrument-sans",
  display: "swap",
});

/** Class names that make the font variables available. */
export const themeFontVars = `${instrumentSerif.variable} ${instrumentSans.variable}`;

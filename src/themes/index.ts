/**
 * Party themes. A theme is colours + fonts (in party.css, keyed by
 * data-theme), default wording, and optional artwork exported from Canva.
 *
 * Adding a theme:
 *  1. Add a [data-theme="your-id"] block in src/app/p/[slug]/party.css
 *  2. Add an entry below
 *  3. (Optional) drop Canva exports in public/themes/your-id/ and list them in `art`
 */

export type SectionKey = "blanket" | "album" | "messages" | "games" | "registry";

export type Theme = {
  id: string;
  name: string;
  /** Small symbol used on the wax seal and stamps */
  motif: "plane" | "heart" | "star";
  /** Default line under the name, if the host doesn't write their own */
  defaultTagline: (occasion: string) => string;
  /** Optional Canva artwork. Any piece left out falls back to the CSS drawing. */
  art?: Partial<Record<SectionKey | "background" | "envelope", string>>;
};

export const THEMES: Record<string, Theme> = {
  explorer: {
    id: "explorer",
    name: "Little Explorer",
    motif: "plane",
    defaultTagline: (occasion) =>
      occasion.toLowerCase().includes("baby") ? "A little explorer is landing soon" : "Adventure awaits",
  },
};

export const DEFAULT_THEME = THEMES.explorer;

export function getTheme(id: string | null | undefined): Theme {
  return (id && THEMES[id]) || DEFAULT_THEME;
}

/**
 * Party themes. A theme is colours + fonts (in party.css, keyed by
 * data-theme), which scrapbook objects it uses, a little wording, and
 * optional artwork exported from Canva.
 *
 * Adding a theme:
 *  1. Add a [data-theme="your-id"] block in src/app/party.css
 *  2. Add an entry below
 *  3. (Optional) drop Canva exports in public/themes/your-id/ and list them in `art`
 */

export type SectionKey = "design" | "album" | "messages" | "games" | "registry";

export type Theme = {
  id: string;
  name: string;
  /** Small symbol used on stickers and stamps */
  motif: "plane" | "heart" | "star";
  /** Decoration pinned to the corner of the welcome card */
  badge: "stamp" | "sticker";
  /** Which drawn object stands for games and registry */
  objects: { games: "blocks" | "boarding-pass"; registry: "gift" | "luggage-tag" };
  /** Optional Canva artwork. Any piece left out falls back to the CSS drawing. */
  art?: Partial<Record<SectionKey | "background", string>>;
};

export const THEMES: Record<string, Theme> = {
  classic: {
    id: "classic",
    name: "Classic (sage and buttercup)",
    motif: "star",
    badge: "sticker",
    objects: { games: "blocks", registry: "gift" },
  },
  explorer: {
    id: "explorer",
    name: "Little Explorer",
    motif: "plane",
    badge: "stamp",
    objects: { games: "boarding-pass", registry: "luggage-tag" },
  },
};

export const DEFAULT_THEME = THEMES.classic;

export function getTheme(id: string | null | undefined): Theme {
  return (id && THEMES[id]) || DEFAULT_THEME;
}

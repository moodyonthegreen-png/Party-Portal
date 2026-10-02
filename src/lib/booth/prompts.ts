/** What a photo booth guest chose to write, and how it's labelled around the site. */
export type BoothPrompt = "note" | "intro" | "memory";

export const BOOTH_PROMPTS: BoothPrompt[] = ["note", "intro", "memory"];

export function isBoothPrompt(v: unknown): v is BoothPrompt {
  return v === "note" || v === "intro" || v === "memory";
}

/** Short tag shown before the words (none for a plain note). */
export function promptTag(p: BoothPrompt | null): string | null {
  return p === "memory" ? "A memory" : p === "intro" ? "Hello!" : null;
}

/** Longer heading, for the keepsake and the full-size view. */
export function promptHeading(p: BoothPrompt | null, first: string): string {
  return p === "memory" ? `A memory of ${first}` : p === "intro" ? `How I know ${first}` : `A note for ${first}`;
}

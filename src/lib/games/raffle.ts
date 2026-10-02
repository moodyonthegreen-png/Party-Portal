/**
 * Raffle entries and drawing. Pure functions (no database), so they can be
 * unit-tested. Guests never sign up: doing an activity enters them.
 */
import type { RaffleRules } from "./settings";

export type RafflePerson = {
  key: string;
  name: string;
  contributions: { design: boolean; note: unknown; photos: number; games: boolean };
};

export type Entrant = { key: string; name: string; entries: number; reasons: string[] };

export const RULE_LABELS: Record<keyof RaffleRules, { short: string; how: string }> = {
  design: { short: "added a design", how: "Add your design for the gift" },
  note: { short: "signed the guest book", how: "Sign the guest book" },
  photos: { short: "shared photos", how: "Share a photo in the album" },
  games: { short: "played a game", how: "Play one of the games" },
};

export function raffleEntrants(people: RafflePerson[], rules: RaffleRules): Entrant[] {
  const out: Entrant[] = [];
  for (const p of people) {
    const reasons: string[] = [];
    if (rules.design && p.contributions.design) reasons.push(RULE_LABELS.design.short);
    if (rules.note && p.contributions.note) reasons.push(RULE_LABELS.note.short);
    if (rules.photos && p.contributions.photos > 0) reasons.push(RULE_LABELS.photos.short);
    if (rules.games && p.contributions.games) reasons.push(RULE_LABELS.games.short);
    if (reasons.length) out.push({ key: p.key, name: p.name, entries: reasons.length, reasons });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Pick one entrant, weighted by entries, skipping anyone in `exclude`
 * (people who already won). `random` returns a number in [0, 1).
 */
export function drawEntrant(entrants: Entrant[], exclude: Set<string>, random: () => number): Entrant | null {
  const pool = entrants.filter((e) => !exclude.has(e.key) && e.entries > 0);
  const total = pool.reduce((n, e) => n + e.entries, 0);
  if (!total) return null;
  let ticket = Math.floor(random() * total);
  for (const e of pool) {
    if (ticket < e.entries) return e;
    ticket -= e.entries;
  }
  return pool[pool.length - 1];
}

/** Uniform random number from the crypto source (server or browser). */
export function secureRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

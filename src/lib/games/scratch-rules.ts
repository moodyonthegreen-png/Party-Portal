/**
 * "Who has the daddy?" rules. Pure functions (no database), so they can be
 * unit-tested.
 */

/**
 * The secret winning card: one of the cards nobody has drawn yet, between
 * the next card and the host's expected number of players. If more people
 * have already played than expected, it's simply the next card.
 */
export function pickWinningCard(drawn: number, expected: number, rand: () => number): number {
  const first = Math.max(0, Math.floor(drawn)) + 1;
  const last = Math.max(first, Math.floor(expected));
  return first + Math.min(last - first, Math.floor(rand() * (last - first + 1)));
}

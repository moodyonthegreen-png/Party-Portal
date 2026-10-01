/**
 * Turn what a host pastes into the guest list box into names and emails.
 * Accepts one guest per line in any of these forms:
 *   Aunt Mimi
 *   Aunt Mimi, mimi@example.com
 *   Aunt Mimi <mimi@example.com>
 *   mimi@example.com Aunt Mimi
 * A line with several commas and no email is treated as a list of names.
 */
export type ParsedGuest = { name: string; email: string | null };

const EMAIL = /[^\s<>,;"]+@[^\s<>,;"]+\.[^\s<>,;"]+/;

export function parseGuestLines(input: string): ParsedGuest[] {
  const out: ParsedGuest[] = [];
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(EMAIL);
    if (m) {
      const email = m[0].toLowerCase();
      const name = line
        .replace(m[0], " ")
        .replace(/[<>()"]/g, " ")
        .replace(/^[\s,;:|\-–]+|[\s,;:|\-–]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      out.push({ name: name || email.split("@")[0], email });
    } else {
      for (const part of line.split(/[,;]+/)) {
        const name = part.trim().replace(/\s+/g, " ");
        if (name) out.push({ name, email: null });
      }
    }
  }
  return out.filter((g) => g.name.length <= 80);
}

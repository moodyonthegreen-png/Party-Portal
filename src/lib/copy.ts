/**
 * Default wording for the guest site. Hosts can replace the tagline and the
 * welcome message with their own; these fill in when they haven't.
 */

/** Line under the guest of honor's name. */
export function defaultTagline(occasion: string): string | null {
  const o = occasion.toLowerCase();
  if (o.includes("baby")) return "The mom-to-be";
  if (o.includes("bridal") || o.includes("wedding")) return "The bride-to-be";
  if (o.includes("birthday")) return "Another trip around the sun";
  if (o.includes("graduat")) return "The graduate";
  if (o.includes("retire")) return "On to the next adventure";
  return null;
}

export function defaultWelcome(name: string): string {
  return `We can't all be in one room, so we're celebrating ${name} from wherever you are. Leave a note, share a photo, and add your touch to a gift made by everyone who loves ${name}.`;
}

/**
 * Thank-you note wording. Pure functions (safe in the browser and in tests).
 */

export type Contributions = {
  design: boolean;
  note: "text" | "audio" | "video" | null;
  photos: number;
  games: boolean;
};

/** "a, b and c" */
export function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function personKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  // Keep titles like "Aunt Mimi" or "Grandpa Joe" together
  if (parts.length > 1 && /^(aunt|auntie|uncle|grandma|grandpa|nana|papa|mimi|cousin|dr\.?|mrs?\.?|ms\.?)$/i.test(parts[0])) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] ?? name;
}

export function contributionPhrases(c: Contributions, guestOfHonorName: string): string[] {
  const out: string[] = [];
  if (c.design) out.push(`your design for ${guestOfHonorName}'s gift`);
  if (c.note === "video") out.push("your video message");
  else if (c.note === "audio") out.push("your voice memo");
  else if (c.note === "text") out.push("your sweet note in the guest book");
  if (c.photos === 1) out.push("the photo you shared");
  else if (c.photos > 1) out.push(`the ${c.photos} photos you shared`);
  if (c.games) out.push("playing along in the games");
  return out;
}

export function draftThankYou(opts: {
  name: string;
  guestOfHonorName: string;
  contributions: Contributions;
  gift: string | null;
  signOff: string | null;
}) {
  const lines: string[] = [`Dear ${firstName(opts.name)},`, ""];
  const body: string[] = [`Thank you so much for celebrating ${opts.guestOfHonorName} with us!`];
  const gift = opts.gift?.trim();
  if (gift) body.push(`We love the ${gift.replace(/^(a|an|the)\s+/i, "")}. It was so thoughtful of you.`);
  const loved = contributionPhrases(opts.contributions, opts.guestOfHonorName);
  if (loved.length) body.push(`${gift ? "And we" : "We"} loved ${joinList(loved)}.`);
  body.push("It meant the world to have you there, even from afar.");
  lines.push(body.join(" "), "", "With love,", opts.signOff?.trim() || opts.guestOfHonorName);
  return lines.join("\n");
}

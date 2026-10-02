import "server-only";
import { DESIGNS_BUCKET, dbError, supabaseAdmin } from "@/lib/supabase/admin";
import { personKey, type Contributions } from "@/lib/thanks-draft";

export type ThankRow = {
  key: string;
  name: string;
  email: string | null;
  onGuestList: boolean;
  contributions: Contributions;
  designUrl: string | null;
  noteText: string | null;
  giftNote: string | null;
  thankedAt: string | null;
  emailedAt: string | null;
  /** When they opened their thank-you card, if one was made */
  cardOpenedAt: string | null;
  hasCard: boolean;
};

/**
 * Everyone the host might thank: people on the guest list plus anyone who
 * added a design, signed the guest book, shared photos or played a game.
 * Matched by name, ignoring capitals and extra spaces.
 */
export async function listThankYous(partyId: string): Promise<ThankRow[]> {
  const db = supabaseAdmin();
  const [guests, messages, photos, babyGuesses, pool, saved, scratch] = await Promise.all([
    db.from("guests").select("name, email, added_by, designs(image_path, status)").eq("party_id", partyId),
    db.from("messages").select("author_name, body, media_type, created_at").eq("party_id", partyId).eq("status", "visible").order("created_at"),
    db.from("photos").select("author_name").eq("party_id", partyId).eq("status", "visible"),
    db.from("baby_photo_guesses").select("player_name").eq("party_id", partyId),
    db.from("pool_entries").select("player_name").eq("party_id", partyId),
    db.from("thank_yous").select("person_key, gift_note, thanked_at, emailed_at").eq("party_id", partyId),
    db.from("scratch_cards").select("player_name").eq("party_id", partyId),
  ]);
  const cards = await db.from("thank_cards").select("person_key, opened_at").eq("party_id", partyId);
  if (guests.error) throw dbError("loading guests for thank-yous", guests.error);

  const people = new Map<string, ThankRow & { designPath: string | null }>();
  const get = (name: string) => {
    const key = personKey(name);
    let p = people.get(key);
    if (!p) {
      p = {
        key,
        name: name.trim(),
        email: null,
        onGuestList: false,
        contributions: { design: false, note: null, photos: 0, games: false },
        designUrl: null,
        designPath: null,
        noteText: null,
        giftNote: null,
        thankedAt: null,
        emailedAt: null,
        cardOpenedAt: null,
        hasCard: false,
      };
      people.set(key, p);
    }
    return p;
  };

  for (const g of guests.data ?? []) {
    const p = get(g.name);
    p.onGuestList = true;
    p.email = g.email ?? p.email;
    const d = (g.designs as unknown as { image_path: string; status: string }[] | null)?.[0];
    if (d && d.status === "visible") {
      p.contributions.design = true;
      p.designPath = d.image_path;
    }
  }
  for (const m of messages.data ?? []) {
    const p = get(m.author_name);
    // Video beats voice memo beats a written note, when someone left more than one
    const rank = { text: 1, audio: 2, video: 3 } as const;
    const kind = (m.media_type as "audio" | "video" | null) ?? "text";
    if (!p.contributions.note || rank[kind] > rank[p.contributions.note]) p.contributions.note = kind;
    if (m.body && !p.noteText) p.noteText = m.body;
  }
  for (const ph of photos.data ?? []) get(ph.author_name).contributions.photos++;
  for (const b of babyGuesses.data ?? []) get(b.player_name).contributions.games = true;
  for (const e of pool.data ?? []) get(e.player_name).contributions.games = true;
  // Missing until the scratch-off game's database update is run; that's fine
  for (const c of (scratch.error ? [] : scratch.data) ?? []) get(c.player_name).contributions.games = true;
  for (const s of saved.data ?? []) {
    const p = people.get(s.person_key);
    if (!p) continue;
    p.giftNote = s.gift_note;
    p.thankedAt = s.thanked_at;
    p.emailedAt = s.emailed_at;
  }

  for (const c of cards.data ?? []) {
    const p = people.get(c.person_key);
    if (!p) continue;
    p.hasCard = true;
    p.cardOpenedAt = c.opened_at;
  }

  const rows = [...people.values()];
  const paths = rows.map((r) => r.designPath).filter((x): x is string => Boolean(x));
  if (paths.length) {
    const { data: signed } = await db.storage.from(DESIGNS_BUCKET).createSignedUrls(paths, 60 * 60);
    const byPath = new Map<string, string>((signed ?? []).map((s) => [String(s.path), String(s.signedUrl)] as [string, string]));
    for (const r of rows) if (r.designPath) r.designUrl = byPath.get(r.designPath) ?? null;
  }

  return rows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ designPath: _drop, ...r }) => r);
}

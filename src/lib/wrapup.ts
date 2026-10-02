import "server-only";
import { listBabyGuesses, listBabyPhotos, listPoolEntries } from "@/lib/games";
import { scoreBabyPhotos, scorePool } from "@/lib/games/scoring";
import type { PublicParty } from "@/lib/parties";
import { PHOTOS_BUCKET } from "@/lib/photos";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";
import { personKey } from "@/lib/thanks-draft";
import { listThankYous } from "@/lib/thanks";

/** One guest's part in the celebration, for the inside of their thank-you card. */
export type WrapUp = {
  notes: { kind: "text" | "audio" | "video"; excerpt: string | null }[];
  photos: { count: number; hearts: number; urls: string[] };
  babyPhoto: { correct: number; total: number; place: number; players: number } | null;
  pool: { place: number; players: number } | null;
  /** Played a game whose results aren't out yet */
  playedGames: boolean;
  rafflePrizes: string[];
  totals: { people: number; designs: number; notes: number; photos: number };
};

const excerpt = (s: string | null, max = 160) => {
  if (!s) return null;
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

export async function getWrapUp(party: PublicParty, key: string): Promise<WrapUp> {
  const db = supabaseAdmin();
  const mine = (name: string) => personKey(name) === key;

  const [messages, photos, people] = await Promise.all([
    db.from("messages").select("author_name, body, media_type").eq("party_id", party.id).eq("status", "visible").order("created_at"),
    db.from("photos").select("author_name, image_path, photo_hearts(device_hash)").eq("party_id", party.id).eq("status", "visible").order("created_at"),
    listThankYous(party.id),
  ]);
  if (messages.error) throw dbError("loading the guest book for a wrap-up", messages.error);
  if (photos.error) throw dbError("loading photos for a wrap-up", photos.error);

  const notes = (messages.data ?? [])
    .filter((m) => mine(m.author_name))
    .slice(0, 3)
    .map((m) => ({ kind: ((m.media_type as "audio" | "video" | null) ?? "text") as "text" | "audio" | "video", excerpt: excerpt(m.body) }));

  const myPhotos = (photos.data ?? []).filter((p) => mine(p.author_name));
  const hearts = myPhotos.reduce((n, p) => n + ((p.photo_hearts as unknown as unknown[] | null)?.length ?? 0), 0);
  let urls: string[] = [];
  if (myPhotos.length) {
    const { data: signed } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(
      myPhotos.slice(0, 3).map((p) => p.image_path),
      60 * 60 * 24,
    );
    urls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
  }

  // Game results, only once the host has revealed them
  let babyPhoto: WrapUp["babyPhoto"] = null;
  let pool: WrapUp["pool"] = null;
  let playedGames = false;
  if (party.sections.games) {
    const [bp, guesses, entries] = await Promise.all([
      listBabyPhotos(party.id),
      listBabyGuesses(party.id, null),
      listPoolEntries(party.id, null),
    ]);
    playedGames = guesses.some((g) => mine(g.name)) || entries.some((e) => mine(e.name));
    if (party.games.babyPhotos.revealed && bp.length) {
      const board = scoreBabyPhotos(bp, guesses);
      const me = board.find((r) => mine(r.name));
      if (me) babyPhoto = { correct: me.correct, total: me.total, place: me.place, players: board.length };
    }
    if (party.games.pool.actual && entries.length) {
      const res = scorePool(party.games.pool.actual, entries);
      const me = res.overall.find((r) => mine(r.name));
      if (me) pool = { place: me.place, players: res.overall.length };
    }
  }

  const rafflePrizes = party.games.raffle.on
    ? party.games.raffle.winners.filter((w): w is NonNullable<typeof w> => Boolean(w) && w!.key === key).map((w) => w.prize)
    : [];

  const joined = people.filter((p) => p.contributions.design || p.contributions.note || p.contributions.photos > 0 || p.contributions.games);
  return {
    notes,
    photos: { count: myPhotos.length, hearts, urls },
    babyPhoto,
    pool,
    playedGames,
    rafflePrizes,
    totals: {
      people: joined.length,
      designs: people.filter((p) => p.contributions.design).length,
      notes: (messages.data ?? []).length,
      photos: (photos.data ?? []).length,
    },
  };
}

import "server-only";
import { PHOTOS_BUCKET } from "@/lib/photos";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";

export type BabyPhoto = { id: string; url: string | null; answer: string };

export async function listBabyPhotos(partyId: string): Promise<BabyPhoto[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("baby_photos")
    .select("id, image_path, answer")
    .eq("party_id", partyId)
    .order("sort")
    .order("created_at");
  if (error) throw dbError("loading baby photos", error);
  const rows = data ?? [];
  const urls = new Map<string, string>();
  if (rows.length) {
    const { data: signed } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(
      rows.map((r) => r.image_path),
      60 * 60 * 3,
    );
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({ id: r.id, url: urls.get(r.image_path) ?? null, answer: r.answer }));
}

export type BabyGuessRow = { name: string; guesses: Record<string, string>; mine: boolean };

export async function listBabyGuesses(partyId: string, deviceHash: string | null): Promise<BabyGuessRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("baby_photo_guesses")
    .select("player_name, guesses, device_hash")
    .eq("party_id", partyId);
  if (error) throw dbError("loading baby photo guesses", error);
  return (data ?? []).map((r) => ({
    name: r.player_name,
    guesses: (r.guesses ?? {}) as Record<string, string>,
    mine: Boolean(deviceHash && r.device_hash === deviceHash),
  }));
}

export type PoolRow = {
  name: string;
  date: string;
  time: string | null;
  weightOz: number;
  lengthIn: number | null;
  mine: boolean;
};

export async function listPoolEntries(partyId: string, deviceHash: string | null): Promise<PoolRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("pool_entries")
    .select("player_name, birth_date, birth_time, weight_oz, length_in, device_hash, updated_at")
    .eq("party_id", partyId)
    .order("birth_date");
  if (error) throw dbError("loading pool entries", error);
  return (data ?? []).map((r) => ({
    name: r.player_name,
    date: r.birth_date,
    time: r.birth_time ? String(r.birth_time).slice(0, 5) : null,
    weightOz: r.weight_oz,
    lengthIn: r.length_in == null ? null : Number(r.length_in),
    mine: Boolean(deviceHash && r.device_hash === deviceHash),
  }));
}

export type TriviaRow = { name: string; answers: Record<string, number>; createdAt: string; mine: boolean };

/** null = the trivia table hasn't been added to the database yet */
export async function listTriviaAnswers(partyId: string, deviceHash: string | null): Promise<TriviaRow[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("trivia_answers")
    .select("player_name, answers, device_hash, created_at")
    .eq("party_id", partyId)
    .order("created_at");
  if (error) return null;
  return (data ?? []).map((r) => ({
    name: r.player_name as string,
    answers: (r.answers ?? {}) as Record<string, number>,
    createdAt: r.created_at as string,
    mine: Boolean(deviceHash && r.device_hash === deviceHash),
  }));
}

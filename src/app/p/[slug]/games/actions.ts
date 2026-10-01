"use server";

import { revalidatePath } from "next/cache";
import { ensureDeviceHash } from "@/lib/device";
import { getParty, hasPartyAccess, type PublicParty } from "@/lib/parties";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function openGames(slug: string): Promise<PublicParty | Result> {
  const party = await getParty(slug);
  if (!party) return fail("We couldn't find this party.");
  if (!(await hasPartyAccess(party))) return fail("Please enter the party password first.");
  if (!party.sections.games) return fail("Games aren't part of this party.");
  return party;
}

const cleanName = (n: string) => n.trim().replace(/\s+/g, " ");

export async function saveBabyGuesses(
  slug: string,
  input: { name: string; guesses: Record<string, string> },
): Promise<Result> {
  const party = await openGames(slug);
  if ("ok" in party) return party;
  if (!party.games.babyPhotos.on) return fail("This game isn't running.");
  if (party.games.babyPhotos.revealed) return fail("The answers have been revealed, so guessing is closed.");

  const name = cleanName(input.name);
  if (!name) return fail("Please add your name.");
  if (name.length > 80) return fail("That name is a bit long.");

  const db = supabaseAdmin();
  const { data: photos } = await db.from("baby_photos").select("id, answer").eq("party_id", party.id);
  const ids = new Set((photos ?? []).map((p) => p.id));
  const answers = new Set((photos ?? []).map((p) => String(p.answer)));

  // Keep only guesses for real photos, using names from the answer list
  const guesses: Record<string, string> = {};
  for (const [id, guess] of Object.entries(input.guesses ?? {})) {
    if (ids.has(id) && answers.has(guess)) guesses[id] = guess;
  }
  if (!Object.keys(guesses).length) return fail("Make at least one guess.");

  const { error } = await db.from("baby_photo_guesses").upsert(
    {
      party_id: party.id,
      device_hash: await ensureDeviceHash(party),
      player_name: name,
      guesses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "party_id,device_hash" },
  );
  if (error) return fail("We couldn't save your guesses. Please try again.");

  revalidatePath(`/p/${party.slug}`, "layout");
  revalidatePath(`/host/${party.slug}`, "layout");
  return { ok: true };
}

export async function savePoolEntry(
  slug: string,
  input: { name: string; date: string; time: string; weightLb: number; weightOz: number; lengthIn: string },
): Promise<Result> {
  const party = await openGames(slug);
  if ("ok" in party) return party;
  const pool = party.games.pool;
  if (!pool.on) return fail("The pool isn't running.");
  if (pool.closed || pool.actual) return fail("Guessing is closed for the pool.");

  const name = cleanName(input.name);
  if (!name) return fail("Please add your name.");
  if (name.length > 80) return fail("That name is a bit long.");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) {
    return fail("Please pick a birth date.");
  }
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : null;

  const lb = Math.floor(Number(input.weightLb));
  const oz = Math.floor(Number(input.weightOz));
  if (!Number.isFinite(lb) || !Number.isFinite(oz) || lb < 1 || lb > 15 || oz < 0 || oz > 15) {
    return fail("Please guess a weight between 1 and 15 lb (ounces 0 to 15).");
  }
  const weightOz = lb * 16 + oz;

  let lengthIn: number | null = null;
  if (input.lengthIn.trim()) {
    lengthIn = Math.round(Number(input.lengthIn) * 10) / 10;
    if (!Number.isFinite(lengthIn) || lengthIn < 10 || lengthIn > 30) {
      return fail("Length should be between 10 and 30 inches (or leave it blank).");
    }
  }

  const { error } = await supabaseAdmin().from("pool_entries").upsert(
    {
      party_id: party.id,
      device_hash: await ensureDeviceHash(party),
      player_name: name,
      birth_date: input.date,
      birth_time: time,
      weight_oz: weightOz,
      length_in: lengthIn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "party_id,device_hash" },
  );
  if (error) return fail("We couldn't save your guess. Please try again.");

  revalidatePath(`/p/${party.slug}`, "layout");
  revalidatePath(`/host/${party.slug}`, "layout");
  return { ok: true };
}

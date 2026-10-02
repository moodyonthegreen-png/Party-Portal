import "server-only";
import { PHOTOS_BUCKET } from "@/lib/photos";
import type { PublicParty } from "@/lib/parties";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { secureRandom } from "./raffle";
import { pickWinningCard } from "./scratch-rules";

export type ScratchCard = { cardNo: number; name: string; winner: boolean };
export type ScratchState = {
  /** False until the database update for this game has been run */
  ready: boolean;
  players: number;
  mine: ScratchCard | null;
  winner: ScratchCard | null;
  photoUrl: string | null;
};

export async function scratchPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin().storage.from(PHOTOS_BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

export async function listScratchCards(partyId: string): Promise<(ScratchCard & { deviceHash: string })[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("scratch_cards")
    .select("card_no, player_name, is_winner, device_hash")
    .eq("party_id", partyId)
    .order("card_no");
  if (error) return null;
  return (data ?? []).map((r) => ({ cardNo: r.card_no as number, name: r.player_name as string, winner: Boolean(r.is_winner), deviceHash: r.device_hash as string }));
}

export async function getScratch(party: PublicParty, deviceHash: string | null): Promise<ScratchState> {
  const [cards, photoUrl] = await Promise.all([listScratchCards(party.id), scratchPhotoUrl(party.games.scratch.photoPath)]);
  const strip = (c: ScratchCard & { deviceHash: string }): ScratchCard => ({ cardNo: c.cardNo, name: c.name, winner: c.winner });
  const mine = cards && deviceHash ? cards.find((c) => c.deviceHash === deviceHash) : undefined;
  const winner = cards?.find((c) => c.winner);
  return {
    ready: cards !== null,
    players: cards?.length ?? 0,
    mine: mine ? strip(mine) : null,
    winner: winner ? strip(winner) : null,
    photoUrl,
  };
}

/** The secret winning card number, or null if none is set. Host and server only. */
export async function getWinningCard(partyId: string): Promise<number | null> {
  const { data } = await supabaseAdmin().from("parties").select("scratch_winner").eq("id", partyId).single();
  const n = Number(data?.scratch_winner);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Pick a fresh secret winning card among the cards not drawn yet. */
export async function setWinningCard(partyId: string, drawn: number, expected: number): Promise<number> {
  const n = pickWinningCard(drawn, expected, secureRandom);
  const { error } = await supabaseAdmin().from("parties").update({ scratch_winner: n }).eq("id", partyId);
  if (error) throw new Error("The scratch-off game isn't switched on yet (the database update hasn't been run).");
  return n;
}

/** Give this browser its card: the next number in line. A browser only ever gets one card. */
export async function drawScratchCard(party: PublicParty, deviceHash: string, name: string): Promise<ScratchCard> {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 6; attempt++) {
    const cards = await listScratchCards(party.id);
    if (!cards) throw new Error("This game isn't ready yet. Please check back soon.");
    const mine = cards.find((c) => c.deviceHash === deviceHash);
    if (mine) return { cardNo: mine.cardNo, name: mine.name, winner: mine.winner };

    const next = (cards.at(-1)?.cardNo ?? 0) + 1;
    const found = cards.some((c) => c.winner);
    let winning = await getWinningCard(party.id);
    if (!found && (winning === null || winning < next)) winning = await setWinningCard(party.id, next - 1, party.games.scratch.expected);
    const winner = !found && winning === next;

    const { error } = await db.from("scratch_cards").insert({ party_id: party.id, card_no: next, device_hash: deviceHash, player_name: name, is_winner: winner });
    if (!error) return { cardNo: next, name, winner };
    if (String(error.code) !== "23505") throw new Error("We couldn't deal your card. Please try again.");
    // Someone else took that card number at the same moment: try the next one
  }
  throw new Error("Lots of people are playing at once. Please try again.");
}

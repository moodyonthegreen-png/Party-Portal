import "server-only";
import { emailConfigured, isEmail, revealEmail, sendEmails } from "@/lib/email";
import { listBabyGuesses, listBabyPhotos, listPoolEntries } from "@/lib/games";
import { scoreBabyPhotos, scorePool } from "@/lib/games/scoring";
import { listGiftSources, listSavedGifts } from "@/lib/gift";
import { PRODUCTS, type ProductKey } from "@/lib/gift/products";
import { previewImageUrl } from "@/lib/gift/preview-url";
import type { BoothPrompt } from "@/lib/booth/prompts";
import { listMemorials, type Memorial } from "@/lib/memorials";
import { listMessages } from "@/lib/messages";
import { getParty, type PublicParty } from "@/lib/parties";
import { listPhotos } from "@/lib/photos";
import { siteOrigin } from "@/lib/site";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";
import { listThankYous } from "@/lib/thanks";

/**
 * The keepsake reveal: everything guests shared, as a step-through story for
 * the guest of honor at /r/<token>.
 */

export type RevealSettings = {
  token: string | null;
  email: string | null;
  auto: boolean;
  sentAt: string | null;
  openedAt: string | null;
};

const NOT_READY = new Set(["42703", "PGRST204"]);

/** null = the reveal columns haven't been added to the database yet */
export async function getRevealSettings(partyId: string): Promise<RevealSettings | null> {
  const { data, error } = await supabaseAdmin()
    .from("parties")
    .select("reveal_token, reveal_email, reveal_auto, reveal_sent_at, reveal_opened_at")
    .eq("id", partyId)
    .single();
  if (error) {
    if (NOT_READY.has(String(error.code))) return null;
    throw dbError("loading keepsake settings", error);
  }
  return {
    token: data.reveal_token,
    email: data.reveal_email,
    auto: Boolean(data.reveal_auto),
    sentAt: data.reveal_sent_at,
    openedAt: data.reveal_opened_at,
  };
}

export async function ensureRevealToken(partyId: string): Promise<string> {
  const current = await getRevealSettings(partyId);
  if (!current) throw new Error("The keepsake isn't switched on yet (the database update hasn't been run).");
  if (current.token) return current.token;
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
  const { error } = await supabaseAdmin().from("parties").update({ reveal_token: token }).eq("id", partyId);
  if (error) throw dbError("making the keepsake link", error);
  return token;
}

export async function findPartyByRevealToken(token: string): Promise<PublicParty | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const { data, error } = await supabaseAdmin().from("parties").select("slug").eq("reveal_token", token).maybeSingle();
  if (error) {
    if (NOT_READY.has(String(error.code))) return null;
    throw dbError("opening the keepsake", error);
  }
  return data ? getParty(data.slug) : null;
}

export async function markRevealOpened(partyId: string) {
  await supabaseAdmin().from("parties").update({ reveal_opened_at: new Date().toISOString() }).eq("id", partyId).is("reveal_opened_at", null);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type RevealData = {
  notes: { id: string; author: string; body: string | null; mediaType: "audio" | "video" | null; mediaUrl: string | null }[];
  photos: { id: string; author: string; caption: string | null; url: string; prompt: BoothPrompt | null; story: string | null }[];
  designs: { name: string; url: string }[];
  games: {
    babyPhoto: { name: string; correct: number; total: number }[] | null;
    /** Prize text per game, when the host offered one */
    prizes: { babyPhotos: string | null; pool: string | null };
    pool: { closest: string[]; date: string[]; weight: string[] } | null;
    raffle: { prize: string; name: string }[];
  };
  gift: { productName: string; imageUrl: string } | null;
  /** The host's memorial notes, for the "watching over you" page */
  memorials: Memorial[];
  names: string[];
};

export async function getRevealData(party: PublicParty): Promise<RevealData> {
  const [messages, photos, designs, saved, people, memorials] = await Promise.all([
    party.sections.messages ? listMessages(party.id) : Promise.resolve([]),
    party.sections.album ? listPhotos(party.id, { limit: 120 }) : Promise.resolve([]),
    listGiftSources(party.id),
    listSavedGifts(party.id).catch(() => []),
    listThankYous(party.id),
    listMemorials(party.id),
  ]);

  // Games: only results the host has already revealed
  let babyPhoto: RevealData["games"]["babyPhoto"] = null;
  let pool: RevealData["games"]["pool"] = null;
  if (party.sections.games) {
    const [bp, guesses, entries] = await Promise.all([listBabyPhotos(party.id), listBabyGuesses(party.id, null), listPoolEntries(party.id, null)]);
    if (party.games.babyPhotos.revealed && bp.length && guesses.length) {
      babyPhoto = scoreBabyPhotos(bp, guesses)
        .filter((r) => r.place <= 3)
        .slice(0, 5)
        .map((r) => ({ name: r.name, correct: r.correct, total: r.total }));
    }
    if (party.games.pool.actual && entries.length) {
      const res = scorePool(party.games.pool.actual, entries);
      pool = { closest: res.overall.filter((r) => r.place === 1).map((r) => r.name), date: res.closestDate, weight: res.closestWeight };
    }
  }
  const raffle = party.games.raffle.on
    ? party.games.raffle.winners.filter((w): w is NonNullable<typeof w> => Boolean(w)).map((w) => ({ prize: w.prize, name: w.name }))
    : [];

  // The finished gift: the party's own product first, using Printify's photo
  let gift: RevealData["gift"] = null;
  const order = [party.giftProduct, ...party.extraProducts];
  const finals = saved
    .filter((g) => g.status === "final" && g.mockups.length)
    .sort((a, b) => order.indexOf(a.productKey) - order.indexOf(b.productKey));
  if (finals[0]) {
    const m = finals[0].mockups.find((x) => x.isDefault) ?? finals[0].mockups[0];
    gift = { productName: PRODUCTS[finals[0].productKey as ProductKey]?.name ?? "Your gift", imageUrl: previewImageUrl(m.src) };
  }

  const names = people
    .filter((p) => p.contributions.design || p.contributions.note || p.contributions.photos > 0 || p.contributions.games)
    .map((p) => p.name);

  return {
    // Oldest first, like reading the guest book from the beginning
    notes: [...messages]
      .reverse()
      .filter((m) => m.body || m.mediaUrl)
      .map((m) => ({ id: m.id, author: m.authorName, body: m.body, mediaType: m.mediaType, mediaUrl: m.mediaUrl })),
    photos: [...photos]
      .reverse()
      .filter((p) => p.url)
      .map((p) => ({ id: p.id, author: p.authorName, caption: p.caption, url: p.url!, prompt: p.prompt, story: p.story })),
    designs: designs.filter((d) => d.url).map((d) => ({ name: d.guestName, url: d.url! })),
    games: {
      babyPhoto,
      pool,
      raffle,
      prizes: {
        babyPhotos: party.games.babyPhotos.prize.on && party.games.babyPhotos.prize.prize ? party.games.babyPhotos.prize.prize : null,
        pool: party.games.pool.prize.on && party.games.pool.prize.prize ? party.games.pool.prize.prize : null,
      },
    },
    gift,
    memorials: memorials.items,
    names,
  };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Email the reveal link. Used by the host's "Send" button and the daily auto-send. */
export async function sendReveal(party: PublicParty, opts: { to: string; fromName: string; replyTo?: string }) {
  if (!emailConfigured()) throw new Error("Email isn't set up yet.");
  if (!isEmail(opts.to)) throw new Error("That email address doesn't look right.");
  const token = await ensureRevealToken(party.id);
  const url = `${await siteOrigin()}/r/${token}`;
  const people = await listThankYous(party.id);
  const count = people.filter((p) => p.contributions.design || p.contributions.note || p.contributions.photos > 0 || p.contributions.games).length;
  await sendEmails([
    revealEmail({
      to: opts.to.trim(),
      guestOfHonorName: party.guestOfHonorName,
      occasion: party.occasion,
      fromName: opts.fromName,
      peopleCount: count,
      url,
      replyTo: opts.replyTo,
    }),
  ]);
  await supabaseAdmin().from("parties").update({ reveal_sent_at: new Date().toISOString() }).eq("id", party.id);
}

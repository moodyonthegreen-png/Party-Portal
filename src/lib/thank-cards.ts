import "server-only";
import { getParty, type PublicParty } from "@/lib/parties";
import { DESIGNS_BUCKET, dbError, supabaseAdmin } from "@/lib/supabase/admin";

export type ThankCard = {
  token: string;
  recipientName: string;
  message: string;
  designUrl: string | null;
  openedAt: string | null;
  party: PublicParty;
  hostName: string | null;
};

export function newCardToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
}

export async function getThankCard(token: string): Promise<ThankCard | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) {
    console.error(`[thank-card] link doesn't look like a card code (length ${token.length})`);
    return null;
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("thank_cards")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw dbError("loading a thank-you card", error);
  if (!data) {
    console.error(`[thank-card] no card saved with code ${token.slice(0, 6)}…`);
    return null;
  }

  // Look the party up separately (no embedded join), so this works even if
  // the database hasn't refreshed its list of table relationships yet.
  const { data: p, error: pErr } = await db.from("parties").select("slug, host_name").eq("id", data.party_id).maybeSingle();
  if (pErr) throw dbError("loading a thank-you card's party", pErr);
  const party = p ? await getParty(p.slug as string) : null;
  if (!party) {
    console.error(`[thank-card] card ${token.slice(0, 6)}… belongs to a party that no longer exists`);
    return null;
  }

  let designUrl: string | null = null;
  if (data.design_path) {
    const { data: signed } = await db.storage.from(DESIGNS_BUCKET).createSignedUrl(data.design_path, 60 * 60 * 24);
    designUrl = signed?.signedUrl ?? null;
  }
  return {
    token: data.token,
    recipientName: data.recipient_name,
    message: data.message,
    designUrl,
    openedAt: data.opened_at,
    party,
    hostName: (data.from_name as string | null) ?? (p?.host_name as string | null) ?? null,
  };
}

export async function markCardOpened(token: string) {
  await supabaseAdmin().from("thank_cards").update({ opened_at: new Date().toISOString() }).eq("token", token).is("opened_at", null);
}

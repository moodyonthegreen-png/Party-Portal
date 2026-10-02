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
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("thank_cards")
    .select("token, recipient_name, message, design_path, opened_at, parties(slug, host_name)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw dbError("loading a thank-you card", error);
  if (!data) return null;

  const p = data.parties as unknown as { slug: string; host_name: string | null } | null;
  const party = p ? await getParty(p.slug) : null;
  if (!party) return null;

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
    hostName: p?.host_name ?? null,
  };
}

export async function markCardOpened(token: string) {
  await supabaseAdmin().from("thank_cards").update({ opened_at: new Date().toISOString() }).eq("token", token).is("opened_at", null);
}

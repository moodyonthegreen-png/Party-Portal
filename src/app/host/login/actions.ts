"use server";

import { emailConfigured, hostLinkEmail, isEmail, sendEmails } from "@/lib/email";
import { issueCoHostLink, issueHostLink } from "@/lib/host";
import { siteOrigin } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LoginState = { sent?: boolean; error?: string };

/**
 * Email fresh host links for every party with this host email. The reply is
 * the same whether or not we found a party, so nobody can use this form to
 * find out who is hosting.
 */
export async function requestHostLinks(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "Please enter your email address." };
  if (!emailConfigured()) return { error: "Email sign-in isn't switched on yet. Please contact Moody Celebrations." };

  const db = supabaseAdmin();
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await db
    .from("parties")
    .select("id, slug, guest_of_honor_name, occasion, host_email, host_link_sent_at, created_at")
    .ilike("host_email", pattern)
    .order("created_at", { ascending: false })
    .limit(10);

  // Parties where this email is a co-host (the guest of honor, or a helper)
  const { data: coRows } = await db
    .from("co_hosts")
    .select("id, party_id, link_sent_at")
    .ilike("email", pattern)
    .order("created_at", { ascending: false })
    .limit(10);
  const coPartyIds = [...new Set((coRows ?? []).map((c) => c.party_id as string))];
  type CoParty = { id: string; guest_of_honor_name: string; occasion: string };
  let coParties: CoParty[] = [];
  if (coPartyIds.length) {
    const { data: rows } = await db.from("parties").select("id, guest_of_honor_name, occasion").in("id", coPartyIds);
    coParties = (rows ?? []) as CoParty[];
  }
  const coPartyById = new Map<string, CoParty>(coParties.map((p) => [p.id, p]));

  // At most one email per party every 2 minutes
  const recent = (iso: string | null) => Boolean(iso) && Date.now() - new Date(iso!).getTime() < 2 * 60_000;
  const fresh = (data ?? []).filter((p) => !recent(p.host_link_sent_at));
  const freshCo = (coRows ?? []).filter((c) => !recent(c.link_sent_at) && coPartyById.has(c.party_id));

  if (fresh.length || freshCo.length) {
    const origin = await siteOrigin();
    const parties: { guestOfHonorName: string; occasion: string; url: string }[] = [];
    for (const p of fresh) {
      parties.push({ guestOfHonorName: p.guest_of_honor_name, occasion: p.occasion, url: `${origin}${await issueHostLink(p.id)}` });
    }
    for (const c of freshCo) {
      const p = coPartyById.get(c.party_id)!;
      parties.push({ guestOfHonorName: p.guest_of_honor_name, occasion: p.occasion, url: `${origin}${await issueCoHostLink(c.id)}` });
    }
    try {
      await sendEmails([hostLinkEmail({ to: email, parties })]);
    } catch {
      return { error: "We couldn't send the email just now. Please try again in a minute." };
    }
  }
  return { sent: true };
}

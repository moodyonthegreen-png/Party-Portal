"use server";

import { emailConfigured, hostLinkEmail, isEmail, sendEmails } from "@/lib/email";
import { issueHostLink } from "@/lib/host";
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
  if (!isEmail(email)) return { error: "Please enter the email address you used when you ordered." };
  if (!emailConfigured()) return { error: "Email sign-in isn't switched on yet. Please contact Moody Celebrations." };

  const { data } = await supabaseAdmin()
    .from("parties")
    .select("id, slug, guest_of_honor_name, occasion, host_email, host_link_sent_at, created_at")
    .ilike("host_email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .order("created_at", { ascending: false })
    .limit(10);

  // At most one email per party every 2 minutes
  const fresh = (data ?? []).filter(
    (p) => !p.host_link_sent_at || Date.now() - new Date(p.host_link_sent_at).getTime() > 2 * 60_000,
  );
  if (fresh.length) {
    const origin = await siteOrigin();
    const parties: { guestOfHonorName: string; occasion: string; url: string }[] = [];
    for (const p of fresh) {
      parties.push({ guestOfHonorName: p.guest_of_honor_name, occasion: p.occasion, url: `${origin}${await issueHostLink(p.id)}` });
    }
    try {
      await sendEmails([hostLinkEmail({ to: email, parties })]);
    } catch {
      return { error: "We couldn't send the email just now. Please try again in a minute." };
    }
  }
  return { sent: true };
}

import "server-only";
import { cookies } from "next/headers";
import { sha256 } from "@/lib/device";
import { getParty, type PublicParty } from "@/lib/parties";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Host access. Each party has a secret host link (/h/<token>). Opening it
 * stores the token in an httpOnly cookie scoped to that party's host pages;
 * every host page and action re-checks the token against the hash in the
 * database, so making a new link instantly switches off the old one.
 */

export const hostCookieName = (slug: string) => `pp_host_${slug}`;
export const hostCookiePath = (slug: string) => `/host/${slug}`;

/** Full party record for the host, including fields guests never see. */
export type HostParty = PublicParty & {
  hostEmail: string;
  hostName: string | null;
  createdAt: string;
};

/** Party for a host link token, or null if the link isn't valid. */
export async function findPartyByHostToken(token: string): Promise<{ slug: string } | null> {
  if (!/^[0-9a-f]{32,128}$/i.test(token)) return null;
  const { data, error } = await supabaseAdmin()
    .from("parties")
    .select("slug")
    .eq("host_token_hash", await sha256(token.toLowerCase()))
    .maybeSingle();
  if (error) throw dbError("checking host link", error);
  return data;
}

/** The party if this browser holds a valid host link for it, otherwise null. */
export async function getHostParty(slug: string): Promise<HostParty | null> {
  const party = await getParty(slug);
  if (!party) return null;

  const token = (await cookies()).get(hostCookieName(party.slug))?.value;
  if (!token) return null;

  const { data, error } = await supabaseAdmin()
    .from("parties")
    .select("host_token_hash, host_email, host_name, created_at")
    .eq("id", party.id)
    .single();
  if (error) throw dbError("checking host access", error);
  if (!data.host_token_hash || data.host_token_hash !== (await sha256(token.toLowerCase()))) return null;

  return { ...party, hostEmail: data.host_email, hostName: data.host_name, createdAt: data.created_at };
}

/** For server actions: the host's party, or an error to show. */
export async function requireHost(slug: string): Promise<HostParty> {
  const party = await getHostParty(slug);
  if (!party) throw new Error("Your host link has expired. Open the link from your email again.");
  return party;
}

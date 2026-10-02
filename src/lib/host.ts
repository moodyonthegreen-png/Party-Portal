import "server-only";
import { cookies } from "next/headers";
import { sha256 } from "@/lib/device";
import { getParty, type PublicParty } from "@/lib/parties";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Host access. The host has a secret link (/h/<token>), and so does each
 * co-host (the guest of honor, or a helper). Opening one stores the token in
 * an httpOnly cookie scoped to that party's host pages; every host page and
 * action re-checks it against the hashes in the database, so making a new
 * link for someone instantly switches off just their old one.
 */

export const hostCookieName = (slug: string) => `pp_host_${slug}`;
export const hostCookiePath = (slug: string) => `/host/${slug}`;

export type CoHostRole = "guest_of_honor" | "helper";

/** Who is using the dashboard right now. */
export type Viewer =
  | { kind: "host"; name: string | null; email: string }
  | { kind: "cohost"; id: string; name: string; email: string; role: CoHostRole };

/** Full party record for the host, including fields guests never see. */
export type HostParty = PublicParty & {
  hostEmail: string;
  hostName: string | null;
  createdAt: string;
  viewer: Viewer;
};

const TOKEN = /^[0-9a-f]{32,128}$/i;

export function newHostToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("hex");
}

/** Party for a host or co-host link token, or null if the link isn't valid. */
export async function findPartyByHostToken(token: string): Promise<{ slug: string } | null> {
  if (!TOKEN.test(token)) return null;
  const db = supabaseAdmin();
  const hash = await sha256(token.toLowerCase());

  const { data, error } = await db.from("parties").select("slug").eq("host_token_hash", hash).maybeSingle();
  if (error) throw dbError("checking host link", error);
  if (data) return data;

  const { data: co, error: coErr } = await db.from("co_hosts").select("id, party_id").eq("token_hash", hash).maybeSingle();
  // Older databases without the co_hosts table: just "not found"
  if (coErr) {
    if (coErr.code !== "42P01" && coErr.code !== "PGRST205") throw dbError("checking co-host link", coErr);
    return null;
  }
  if (!co) return null;
  await db.from("co_hosts").update({ last_opened_at: new Date().toISOString() }).eq("id", co.id);
  const { data: p, error: pErr } = await db.from("parties").select("slug").eq("id", co.party_id).maybeSingle();
  if (pErr) throw dbError("checking co-host link", pErr);
  return p;
}

/** The party if this browser holds a valid host or co-host link for it, otherwise null. */
export async function getHostParty(slug: string): Promise<HostParty | null> {
  const party = await getParty(slug);
  if (!party) return null;

  const token = (await cookies()).get(hostCookieName(party.slug))?.value;
  if (!token || !TOKEN.test(token)) return null;
  const hash = await sha256(token.toLowerCase());

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("parties")
    .select("host_token_hash, host_email, host_name, created_at")
    .eq("id", party.id)
    .single();
  if (error) throw dbError("checking host access", error);
  const base = { ...party, hostEmail: data.host_email as string, hostName: data.host_name as string | null, createdAt: data.created_at as string };

  if (data.host_token_hash && data.host_token_hash === hash) {
    return { ...base, viewer: { kind: "host", name: base.hostName, email: base.hostEmail } };
  }

  const { data: co, error: coErr } = await db
    .from("co_hosts")
    .select("id, name, email, role")
    .eq("party_id", party.id)
    .eq("token_hash", hash)
    .maybeSingle();
  if (coErr) {
    if (coErr.code !== "42P01" && coErr.code !== "PGRST205") throw dbError("checking co-host access", coErr);
    return null;
  }
  if (!co) return null;
  return { ...base, viewer: { kind: "cohost", id: co.id, name: co.name, email: co.email, role: co.role as CoHostRole } };
}

/** For server actions: the host's party, or an error to show. */
export async function requireHost(slug: string): Promise<HostParty> {
  const party = await getHostParty(slug);
  if (!party) throw new Error("Your host link has expired. Open the link from your email again.");
  return party;
}

/** Name to sign notes and emails with: whoever is using the dashboard. */
export function viewerName(party: HostParty): string | null {
  return party.viewer.kind === "cohost" ? party.viewer.name : party.hostName;
}

/**
 * Make a fresh host link for a party (switching off the old one) and return
 * the path to open, e.g. "/h/3f9a...".
 */
export async function issueHostLink(partyId: string): Promise<string> {
  const token = newHostToken();
  const { error } = await supabaseAdmin()
    .from("parties")
    .update({ host_token_hash: await sha256(token), host_link_sent_at: new Date().toISOString() })
    .eq("id", partyId);
  if (error) throw dbError("making a host link", error);
  return `/h/${token}`;
}

/** Fresh link for one co-host (switching off only their old one). */
export async function issueCoHostLink(coHostId: string): Promise<string> {
  const token = newHostToken();
  const { error } = await supabaseAdmin()
    .from("co_hosts")
    .update({ token_hash: await sha256(token), link_sent_at: new Date().toISOString() })
    .eq("id", coHostId);
  if (error) throw dbError("making a co-host link", error);
  return `/h/${token}`;
}

export type CoHost = {
  id: string;
  name: string;
  email: string;
  role: CoHostRole;
  linkSentAt: string | null;
  lastOpenedAt: string | null;
};

export async function listCoHosts(partyId: string): Promise<CoHost[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("co_hosts")
    .select("id, name, email, role, link_sent_at, last_opened_at")
    .eq("party_id", partyId)
    .order("created_at");
  if (error) {
    // null = the co_hosts table hasn't been created yet
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw dbError("loading co-hosts", error);
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    role: c.role as CoHostRole,
    linkSentAt: c.link_sent_at,
    lastOpenedAt: c.last_opened_at,
  }));
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { parseGames, type GameSettings } from "@/lib/games/settings";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";

export type PartySections = {
  design: boolean;
  album: boolean;
  messages: boolean;
  games: boolean;
  registry: boolean;
};

/** The subset of a party that is safe to show guests. */
export type PublicParty = {
  id: string;
  slug: string;
  guestOfHonorName: string;
  occasion: string;
  title: string | null;
  welcomeMessage: string | null;
  /** Line under the name, e.g. "A little explorer is landing soon" */
  tagline: string | null;
  /** When the celebration itself happens (optional) */
  eventDate: string | null;
  /** Deadline for guests to add their design for the group gift */
  deadline: string;
  theme: string;
  sections: PartySections;
  games: GameSettings;
  registryUrl: string | null;
  requireGuestList: boolean;
  hasPassword: boolean;
  isOpen: boolean;
};

export const getParty = cache(async (slug: string): Promise<PublicParty | null> => {
  const { data, error } = await supabaseAdmin()
    .from("parties")
    // "*" so newer optional columns (tagline, event_date) don't break older databases
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();

  if (error) throw dbError("loading party", error);
  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    guestOfHonorName: data.guest_of_honor_name,
    occasion: data.occasion,
    title: data.title,
    welcomeMessage: data.welcome_message,
    tagline: data.tagline ?? null,
    eventDate: data.event_date ?? null,
    deadline: data.deadline,
    theme: data.theme,
    sections: data.sections as PartySections,
    games: parseGames(data.games),
    registryUrl: data.registry_url,
    requireGuestList: data.require_guest_list,
    hasPassword: data.password_hash !== null,
    isOpen: new Date(data.deadline).getTime() > Date.now(),
  };
});

export async function getGuestNames(partyId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("guests")
    .select("name")
    .eq("party_id", partyId)
    .order("name");
  if (error) throw dbError("loading guest list", error);
  return (data ?? []).map((g) => g.name);
}

/** Names of guests who already have a design, so we can show "replace" instead of "add". */
export async function getSubmittedGuestNames(partyId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("designs")
    .select("guests(name)")
    .eq("party_id", partyId);
  if (error) throw dbError("loading submitted designs", error);
  return (data ?? [])
    .map((d) => (d.guests as unknown as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n));
}

// ---------------------------------------------------------------------------
// Optional party password. A correct password sets an httpOnly cookie scoped
// to this party for 30 days. The cookie stores a hash of the party id plus a
// server secret, not the password itself.
// ---------------------------------------------------------------------------

export function accessCookieName(slug: string) {
  return `pp_access_${slug}`;
}

async function accessToken(partyId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bytes = new TextEncoder().encode(`${partyId}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("base64url");
}

export async function hasPartyAccess(party: PublicParty): Promise<boolean> {
  if (!party.hasPassword) return true;
  const jar = await cookies();
  const value = jar.get(accessCookieName(party.slug))?.value;
  return value !== undefined && value === (await accessToken(party.id));
}

export async function grantPartyAccess(party: PublicParty) {
  const jar = await cookies();
  jar.set(accessCookieName(party.slug), await accessToken(party.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/p/${party.slug}`,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function checkPartyPassword(slug: string, password: string) {
  const { data, error } = await supabaseAdmin().rpc("check_party_password", {
    p_slug: slug,
    p_password: password,
  });
  if (error) throw dbError("checking party password", error);
  return data === true;
}

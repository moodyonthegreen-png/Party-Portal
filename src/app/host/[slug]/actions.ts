"use server";

import { revalidatePath } from "next/cache";
import { requireHost, type HostParty } from "@/lib/host";
import { DESIGNS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { THEMES } from "@/themes";

export type ActionState = { ok?: boolean; error?: string; message?: string };

const UUID = /^[0-9a-f-]{36}$/i;

async function host(slug: string): Promise<HostParty | ActionState> {
  try {
    return await requireHost(slug);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Please open your host link again." };
  }
}
const isState = (x: HostParty | ActionState): x is ActionState => !("id" in x);

function refresh(slug: string) {
  revalidatePath(`/host/${slug}`, "layout");
  revalidatePath(`/p/${slug}`, "layout");
}

/** Delete every stored file for one guest's design(s). */
async function removeGuestFiles(partyId: string, guestId: string) {
  const bucket = supabaseAdmin().storage.from(DESIGNS_BUCKET);
  const folder = `${partyId}/${guestId}`;
  const { data } = await bucket.list(folder, { limit: 100 });
  if (data?.length) await bucket.remove(data.map((f) => `${folder}/${f.name}`));
}

// ---------------------------------------------------------------------------
// Guest list
// ---------------------------------------------------------------------------

export async function addGuests(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;

  const names = String(formData.get("names") ?? "")
    .split(/[\n,;]+/)
    .map((n) => n.trim().replace(/\s+/g, " "))
    .filter((n) => n.length > 0 && n.length <= 80);
  if (!names.length) return { error: "Type at least one name." };
  if (names.length > 300) return { error: "That's a lot of names! Please add up to 300 at a time." };

  const db = supabaseAdmin();
  const { data: existing, error: listErr } = await db.from("guests").select("name").eq("party_id", party.id);
  if (listErr) return { error: "Something went wrong. Please try again." };

  const seen = new Set((existing ?? []).map((g) => String(g.name).toLowerCase()));
  const fresh: string[] = [];
  for (const n of names) {
    const key = n.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      fresh.push(n);
    }
  }
  if (!fresh.length) return { ok: true, message: "Everyone you typed is already on the list." };

  const { error } = await db
    .from("guests")
    .insert(fresh.map((name) => ({ party_id: party.id, name, added_by: "host" })));
  if (error) return { error: "We couldn't add those names. Please try again." };

  refresh(party.slug);
  const skipped = names.length - fresh.length;
  return {
    ok: true,
    message: `Added ${fresh.length} ${fresh.length === 1 ? "guest" : "guests"}${skipped ? ` (${skipped} already on the list)` : ""}.`,
  };
}

export async function removeGuest(slug: string, guestId: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(guestId)) return { error: "That guest wasn't found." };

  await removeGuestFiles(party.id, guestId);
  const { error } = await supabaseAdmin().from("guests").delete().eq("id", guestId).eq("party_id", party.id);
  if (error) return { error: "We couldn't remove that guest. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

export async function setDesignHidden(slug: string, guestId: string, hidden: boolean): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(guestId)) return { error: "That design wasn't found." };

  const { error } = await supabaseAdmin()
    .from("designs")
    .update({ status: hidden ? "hidden" : "visible" })
    .eq("party_id", party.id)
    .eq("guest_id", guestId);
  if (error) return { error: "We couldn't update that design. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

export async function deleteDesign(slug: string, guestId: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(guestId)) return { error: "That design wasn't found." };

  await removeGuestFiles(party.id, guestId);
  const { error } = await supabaseAdmin().from("designs").delete().eq("party_id", party.id).eq("guest_id", guestId);
  if (error) return { error: "We couldn't delete that design. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Party details
// ---------------------------------------------------------------------------

function text(formData: FormData, key: string, max: number): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function isoOrNull(v: FormDataEntryValue | null): string | null | "invalid" {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

export async function updateDetails(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;

  const name = text(formData, "guest_of_honor_name", 80);
  if (!name) return { error: "Please add the guest of honor's name." };

  const occasion = text(formData, "occasion", 60) ?? "Celebration";

  // The browser sends these already converted from the host's local time
  const eventDate = isoOrNull(formData.get("event_date_iso"));
  const deadline = isoOrNull(formData.get("deadline_iso"));
  if (eventDate === "invalid" || deadline === "invalid") return { error: "One of the dates didn't look right." };
  if (!deadline) return { error: "Please set a deadline for guests to add their designs." };

  let registryUrl = text(formData, "registry_url", 500);
  if (registryUrl) {
    if (!/^https?:\/\//i.test(registryUrl)) registryUrl = `https://${registryUrl}`;
    try {
      const u = new URL(registryUrl);
      if (!u.hostname.includes(".")) throw new Error();
    } catch {
      return { error: "The registry link doesn't look like a web address." };
    }
  }

  const theme = String(formData.get("theme") ?? "");
  if (!THEMES[theme]) return { error: "Please choose a theme." };

  const sections = {
    design: formData.get("section_design") === "on",
    album: formData.get("section_album") === "on",
    messages: formData.get("section_messages") === "on",
    games: formData.get("section_games") === "on",
    registry: Boolean(registryUrl),
  };

  const { error } = await supabaseAdmin()
    .from("parties")
    .update({
      guest_of_honor_name: name,
      occasion,
      tagline: text(formData, "tagline", 120),
      welcome_message: text(formData, "welcome_message", 1500),
      event_date: eventDate,
      deadline,
      theme,
      registry_url: registryUrl,
      sections,
      require_guest_list: formData.get("require_guest_list") === "on",
      host_name: text(formData, "host_name", 80),
    })
    .eq("id", party.id);
  if (error) return { error: "We couldn't save your changes. Please try again." };

  refresh(party.slug);
  return { ok: true, message: "Saved! Your guest page is updated." };
}

export async function setPartyPassword(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;

  const remove = formData.get("remove") === "1";
  const password = String(formData.get("password") ?? "").trim();
  if (!remove && password.length < 4) return { error: "Use at least 4 characters." };
  if (password.length > 60) return { error: "That password is too long." };

  const { error } = await supabaseAdmin().rpc("set_party_password", {
    p_party_id: party.id,
    p_password: remove ? null : password,
  });
  if (error) return { error: "We couldn't update the password. Please try again." };

  refresh(party.slug);
  return {
    ok: true,
    message: remove
      ? "Password removed. Anyone with the link can join."
      : "Password set. Guests will be asked for it once on each device.",
  };
}

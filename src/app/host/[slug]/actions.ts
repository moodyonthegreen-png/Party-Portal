"use server";

import { revalidatePath } from "next/cache";
import { sanitizeLayout } from "@/lib/gift/layout";
import { ownedProducts, PRODUCTS, type ProductKey } from "@/lib/gift/products";
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

// ---------------------------------------------------------------------------
// Message board moderation
// ---------------------------------------------------------------------------

export async function setMessageHidden(slug: string, id: string, hidden: boolean): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That note wasn't found." };

  const { error } = await supabaseAdmin()
    .from("messages")
    .update({ status: hidden ? "hidden" : "visible" })
    .eq("id", id)
    .eq("party_id", party.id)
    .neq("status", "pending");
  if (error) return { error: "We couldn't update that note. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

export async function deleteMessage(slug: string, id: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That note wasn't found." };

  const db = supabaseAdmin();
  const { data } = await db.from("messages").select("media_path").eq("id", id).eq("party_id", party.id).maybeSingle();
  if (data?.media_path) await db.storage.from("media").remove([data.media_path]);
  const { error } = await db.from("messages").delete().eq("id", id).eq("party_id", party.id);
  if (error) return { error: "We couldn't delete that note. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Photo album moderation
// ---------------------------------------------------------------------------

export async function setPhotoHidden(slug: string, id: string, hidden: boolean): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That photo wasn't found." };

  const { error } = await supabaseAdmin()
    .from("photos")
    .update({ status: hidden ? "hidden" : "visible" })
    .eq("id", id)
    .eq("party_id", party.id)
    .neq("status", "pending");
  if (error) return { error: "We couldn't update that photo. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

export async function deletePhoto(slug: string, id: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That photo wasn't found." };

  const db = supabaseAdmin();
  const { data } = await db
    .from("photos")
    .select("image_path, original_path")
    .eq("id", id)
    .eq("party_id", party.id)
    .maybeSingle();
  if (data) await db.storage.from("photos").remove([data.image_path, data.original_path]);
  const { error } = await db.from("photos").delete().eq("id", id).eq("party_id", party.id);
  if (error) return { error: "We couldn't delete that photo. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

async function saveGames(party: HostParty, games: HostParty["games"]): Promise<ActionState> {
  const { error } = await supabaseAdmin().from("parties").update({ games }).eq("id", party.id);
  if (error) return { error: "We couldn't save that. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

export async function setBabyPhotoGame(slug: string, patch: { on?: boolean; revealed?: boolean }): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  return saveGames(party, { ...party.games, babyPhotos: { ...party.games.babyPhotos, ...patch } });
}

export async function setPoolGame(slug: string, patch: { on?: boolean; closed?: boolean }): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  return saveGames(party, { ...party.games, pool: { ...party.games.pool, ...patch } });
}

/** Post the real birth details (closes guessing and shows results), or clear them. */
export async function setPoolResults(
  slug: string,
  input: { date: string; time: string; weightLb: number; weightOz: number; lengthIn: string } | null,
): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;

  if (!input) return saveGames(party, { ...party.games, pool: { ...party.games.pool, actual: null } });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Please enter the birth date." };
  const lb = Math.floor(Number(input.weightLb));
  const oz = Math.floor(Number(input.weightOz));
  if (!(lb >= 1 && lb <= 15 && oz >= 0 && oz <= 15)) return { error: "Please enter the weight (1 to 15 lb)." };
  let lengthIn: number | null = null;
  if (input.lengthIn.trim()) {
    lengthIn = Math.round(Number(input.lengthIn) * 10) / 10;
    if (!(lengthIn >= 10 && lengthIn <= 30)) return { error: "Length should be between 10 and 30 inches, or blank." };
  }
  return saveGames(party, {
    ...party.games,
    pool: {
      ...party.games.pool,
      closed: true,
      actual: {
        date: input.date,
        time: /^\d{2}:\d{2}$/.test(input.time) ? input.time : null,
        weightOz: lb * 16 + oz,
        lengthIn,
      },
    },
  });
}

export async function startBabyPhoto(
  slug: string,
  answer: string,
): Promise<{ ok: true; id: string; path: string; token: string } | { ok: false; error: string }> {
  const party = await host(slug);
  if (isState(party)) return { ok: false, error: party.error ?? "Please open your host link again." };
  const name = answer.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Add who's in the photo." };
  if (name.length > 80) return { ok: false, error: "That name is a bit long." };

  const id = crypto.randomUUID();
  const { data, error } = await supabaseAdmin().storage.from("photos").createSignedUploadUrl(`${party.id}/baby/${id}.jpg`);
  if (error || !data) return { ok: false, error: "We couldn't get ready to upload. Please try again." };
  return { ok: true, id, path: data.path, token: data.token };
}

export async function finishBabyPhoto(slug: string, id: string, answer: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That photo wasn't found." };
  const name = answer.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return { error: "Add who's in the photo." };

  const db = supabaseAdmin();
  const { data: files } = await db.storage.from("photos").list(`${party.id}/baby`, { search: id, limit: 2 });
  if (!files?.some((f) => f.name === `${id}.jpg`)) return { error: "The photo didn't finish uploading. Please try again." };

  const { count } = await db.from("baby_photos").select("id", { count: "exact", head: true }).eq("party_id", party.id);
  const { error } = await db.from("baby_photos").insert({
    id,
    party_id: party.id,
    image_path: `${party.id}/baby/${id}.jpg`,
    answer: name,
    sort: count ?? 0,
  });
  if (error) return { error: "We couldn't save that photo. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

export async function deleteBabyPhoto(slug: string, id: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That photo wasn't found." };
  const db = supabaseAdmin();
  const { data } = await db.from("baby_photos").select("image_path").eq("id", id).eq("party_id", party.id).maybeSingle();
  if (data) await db.storage.from("photos").remove([data.image_path]);
  await db.from("baby_photos").delete().eq("id", id).eq("party_id", party.id);
  refresh(party.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Group-gift designer
// ---------------------------------------------------------------------------


const isProduct = (k: string): k is ProductKey => k in PRODUCTS;
const owns = (party: HostParty, k: string) => ownedProducts(party.giftProduct, party.extraProducts).includes(k as ProductKey);

export async function saveGiftLayout(slug: string, productKey: string, layout: unknown): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!isProduct(productKey)) return { error: "Unknown product." };
  if (!owns(party, productKey)) return { error: "Add this product to your order to save a design for it." };

  const { error } = await supabaseAdmin()
    .from("gift_designs")
    .upsert(
      {
        party_id: party.id,
        product_key: productKey,
        layout: sanitizeLayout(layout),
        // Any edit after finalizing means the print file needs making again
        status: "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "party_id,product_key" },
    );
  if (error) return { error: "We couldn't save your layout. Please try again." };
  return { ok: true };
}

export async function startGiftPrint(
  slug: string,
  productKey: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const party = await host(slug);
  if (isState(party)) return { ok: false, error: party.error ?? "Please open your host link again." };
  if (!isProduct(productKey)) return { ok: false, error: "Unknown product." };
  if (!owns(party, productKey)) return { ok: false, error: "Add this product to your order to print it." };
  const ext = PRODUCTS[productKey].format === "png" ? "png" : "jpg";
  const path = `${party.id}/${productKey}-${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from("prints").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "We couldn't get ready to save the print file." };
  return { ok: true, path: data.path, token: data.token };
}

export async function finishGiftPrint(slug: string, productKey: string, path: string, layout: unknown): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!isProduct(productKey)) return { error: "Unknown product." };
  if (!owns(party, productKey)) return { error: "Add this product to your order to print it." };
  if (!path.startsWith(`${party.id}/${productKey}-`)) return { error: "That print file doesn't belong to this party." };

  const db = supabaseAdmin();
  const name = path.split("/").pop()!;
  const { data: files } = await db.storage.from("prints").list(party.id, { search: name, limit: 2 });
  if (!files?.some((f) => f.name === name)) return { error: "The print file didn't finish uploading. Please try again." };

  // Keep only the newest print file for this product
  const { data: old } = await db
    .from("gift_designs")
    .select("print_path")
    .eq("party_id", party.id)
    .eq("product_key", productKey)
    .maybeSingle();
  if (old?.print_path && old.print_path !== path) await db.storage.from("prints").remove([old.print_path]);

  const now = new Date().toISOString();
  const { error } = await db.from("gift_designs").upsert(
    {
      party_id: party.id,
      product_key: productKey,
      layout: sanitizeLayout(layout),
      status: "final",
      print_path: path,
      finalized_at: now,
      updated_at: now,
    },
    { onConflict: "party_id,product_key" },
  );
  if (error) return { error: "We couldn't save the finished design. Please try again." };
  refresh(party.slug);
  return { ok: true };
}

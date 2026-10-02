"use server";

import { revalidatePath } from "next/cache";
import { drawEntrant, raffleEntrants, secureRandom } from "@/lib/games/raffle";
import { MAX_PRIZES, type RaffleRules } from "@/lib/games/settings";
import { sanitizeLayout } from "@/lib/gift/layout";
import { listThankYous } from "@/lib/thanks";
import { buildDownload, type DownloadManifest, type DownloadSection } from "@/lib/download";
import { ensureRevealToken, getRevealSettings, sendReveal } from "@/lib/reveal";
import { ownedProducts, PRODUCTS, type ProductKey } from "@/lib/gift/products";
import { coHostInviteEmail, EmailError, raffleWinnerEmail, emailConfigured, isEmail, reminderEmail, sendEmails, thankYouCardEmail } from "@/lib/email";
import { parseGuestLines } from "@/lib/guests";
import { issueCoHostLink, requireHost, viewerName, type HostParty } from "@/lib/host";
import { newCardToken } from "@/lib/thank-cards";
import { createDraftProduct, deleteProduct, PrintifyError, printifyConfigured, type Mockup } from "@/lib/printify";
import { DESIGNS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site";
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

  const parsed = parseGuestLines(String(formData.get("names") ?? ""));
  if (!parsed.length) return { error: "Type at least one name." };
  if (parsed.length > 300) return { error: "That's a lot of names! Please add up to 300 at a time." };

  const db = supabaseAdmin();
  const { data: existing, error: listErr } = await db.from("guests").select("id, name, email").eq("party_id", party.id);
  if (listErr) return { error: "Something went wrong. Please try again." };

  type Existing = { id: string; name: string; email: string | null };
  const byName = new Map<string, Existing>(
    ((existing ?? []) as Existing[]).map((g) => [String(g.name).toLowerCase(), g] as [string, Existing]),
  );
  const fresh: { name: string; email: string | null }[] = [];
  let updated = 0;
  for (const g of parsed) {
    const key = g.name.toLowerCase();
    const found = byName.get(key);
    if (found) {
      // Already listed: just add or change their email
      if (g.email && g.email !== found.email) {
        await db.from("guests").update({ email: g.email }).eq("id", found.id);
        updated++;
      }
    } else if (!fresh.some((f) => f.name.toLowerCase() === key)) {
      fresh.push(g);
    }
  }

  if (fresh.length) {
    const { error } = await db
      .from("guests")
      .insert(fresh.map((g) => ({ party_id: party.id, name: g.name, email: g.email, added_by: "host" })));
    if (error) return { error: "We couldn't add those names. Please try again." };
  }
  if (!fresh.length && !updated) return { ok: true, message: "Everyone you typed is already on the list." };

  refresh(party.slug);
  const parts: string[] = [];
  if (fresh.length) parts.push(`Added ${fresh.length} ${fresh.length === 1 ? "guest" : "guests"}`);
  if (updated) parts.push(`updated ${updated} ${updated === 1 ? "email" : "emails"}`);
  return { ok: true, message: `${parts.join(" and ")}.` };
}

/** Email a reminder to listed guests who haven't added a design (at most once a day each). */
export async function sendReminders(slug: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!party.isOpen) return { error: "The deadline has passed." };
  if (!emailConfigured()) return { error: "Email isn't set up yet." };

  const db = supabaseAdmin();
  const { data: guests, error } = await db
    .from("guests")
    .select("id, name, email, reminded_at, designs(id)")
    .eq("party_id", party.id)
    .not("email", "is", null);
  if (error) return { error: "Something went wrong. Please try again." };

  const dayAgo = Date.now() - 20 * 60 * 60 * 1000;
  const due = (guests ?? []).filter((g) => {
    const hasDesign = ((g.designs as unknown as unknown[] | null) ?? []).length > 0;
    return !hasDesign && g.email && isEmail(g.email) && (!g.reminded_at || new Date(g.reminded_at).getTime() < dayAgo);
  });
  if (!due.length) return { ok: true, message: "Everyone with an email has either added a design or had a reminder today." };

  const url = `${await siteOrigin()}/p/${party.slug}/design`;
  try {
    await sendEmails(
      due.map((g) =>
        reminderEmail({
          to: g.email!,
          guestName: g.name,
          guestOfHonorName: party.guestOfHonorName,
          deadline: party.deadline,
          url,
          hostName: party.hostName,
          replyTo: isEmail(party.hostEmail) ? party.hostEmail : undefined,
        }),
      ),
    );
  } catch (e) {
    return { error: e instanceof EmailError ? e.message : "We couldn't send the reminders. Please try again." };
  }
  await db
    .from("guests")
    .update({ reminded_at: new Date().toISOString() })
    .in(
      "id",
      due.map((g) => g.id),
    );
  refresh(party.slug);
  return { ok: true, message: `Sent ${due.length} ${due.length === 1 ? "reminder" : "reminders"}.` };
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

/**
 * After finalizing: send the print file to Printify as an unpublished draft
 * product and keep the product photos it makes.
 */
export async function makeGiftMockups(
  slug: string,
  productKey: string,
): Promise<{ ok: true; mockups: Mockup[]; provider: string } | { ok: false; error: string }> {
  const party = await host(slug);
  if (isState(party)) return { ok: false, error: party.error ?? "Please open your host link again." };
  if (!isProduct(productKey) || !owns(party, productKey)) return { ok: false, error: "Unknown product." };
  if (!printifyConfigured()) return { ok: false, error: "Printify isn't connected yet." };

  const db = supabaseAdmin();
  const { data: gift } = await db
    .from("gift_designs")
    .select("print_path, printify_product_id, status")
    .eq("party_id", party.id)
    .eq("product_key", productKey)
    .maybeSingle();
  if (!gift?.print_path || gift.status !== "final") return { ok: false, error: "Finalize the design first." };

  const { data: signed } = await db.storage.from("prints").createSignedUrl(gift.print_path, 60 * 30);
  if (!signed?.signedUrl) return { ok: false, error: "We couldn't read the print file. Please try again." };

  const product = PRODUCTS[productKey];
  try {
    const made = await createDraftProduct({
      product,
      title: `${party.guestOfHonorName}'s ${product.name} (${party.slug})`,
      printFileUrl: signed.signedUrl,
      fileName: gift.print_path.split("/").pop()!,
    });
    if (gift.printify_product_id && gift.printify_product_id !== made.productId) {
      await deleteProduct(gift.printify_product_id);
    }
    await db
      .from("gift_designs")
      .update({ printify_product_id: made.productId, printify_provider: made.provider, mockups: made.mockups })
      .eq("party_id", party.id)
      .eq("product_key", productKey);
    return { ok: true, mockups: made.mockups, provider: made.provider };
  } catch (e) {
    return { ok: false, error: e instanceof PrintifyError ? e.message : "Printify couldn't make the product photos." };
  }
}

// ---------------------------------------------------------------------------
// Printify photos for products the host is only previewing (upsells)
// ---------------------------------------------------------------------------

export async function startPreviewUpload(
  slug: string,
  productKey: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const party = await host(slug);
  if (isState(party)) return { ok: false, error: party.error ?? "Please open your host link again." };
  if (!isProduct(productKey)) return { ok: false, error: "Unknown product." };
  if (!printifyConfigured()) return { ok: false, error: "Printify isn't connected yet." };

  // A little breathing room between requests, so Printify isn't flooded
  const { data: last } = await supabaseAdmin()
    .from("gift_previews")
    .select("created_at")
    .eq("party_id", party.id)
    .eq("product_key", productKey)
    .maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < 30_000) {
    return { ok: false, error: "Those photos were just made. Give it a few seconds before trying again." };
  }

  const ext = PRODUCTS[productKey].format === "png" ? "png" : "jpg";
  const path = `${party.id}/previews/${productKey}-${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from("prints").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "We couldn't get ready to make the preview." };
  return { ok: true, path: data.path, token: data.token };
}

export async function makePreviewMockups(
  slug: string,
  productKey: string,
  path: string,
): Promise<{ ok: true; mockups: Mockup[]; provider: string } | { ok: false; error: string }> {
  const party = await host(slug);
  if (isState(party)) return { ok: false, error: party.error ?? "Please open your host link again." };
  if (!isProduct(productKey)) return { ok: false, error: "Unknown product." };
  if (!path.startsWith(`${party.id}/previews/${productKey}-`)) return { ok: false, error: "That preview doesn't belong to this party." };

  const db = supabaseAdmin();
  const { data: signed } = await db.storage.from("prints").createSignedUrl(path, 60 * 30);
  if (!signed?.signedUrl) return { ok: false, error: "The preview didn't finish uploading. Please try again." };

  const { data: old } = await db
    .from("gift_previews")
    .select("file_path, printify_product_id")
    .eq("party_id", party.id)
    .eq("product_key", productKey)
    .maybeSingle();

  const product = PRODUCTS[productKey];
  try {
    const made = await createDraftProduct({
      product,
      title: `PREVIEW ${party.guestOfHonorName}'s ${product.name} (${party.slug})`,
      printFileUrl: signed.signedUrl,
      fileName: path.split("/").pop()!,
    });
    await db.from("gift_previews").upsert(
      {
        party_id: party.id,
        product_key: productKey,
        file_path: path,
        printify_product_id: made.productId,
        printify_provider: made.provider,
        mockups: made.mockups,
        created_at: new Date().toISOString(),
      },
      { onConflict: "party_id,product_key" },
    );
    // Tidy up the previous preview
    if (old?.printify_product_id && old.printify_product_id !== made.productId) await deleteProduct(old.printify_product_id);
    if (old?.file_path && old.file_path !== path) await db.storage.from("prints").remove([old.file_path]);
    return { ok: true, mockups: made.mockups, provider: made.provider };
  } catch (e) {
    await db.storage.from("prints").remove([path]);
    return { ok: false, error: e instanceof PrintifyError ? e.message : "Printify couldn't make the product photos." };
  }
}

// ---------------------------------------------------------------------------
// Thank-you helper
// ---------------------------------------------------------------------------

function cleanKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

async function saveThank(partyId: string, key: string, patch: Record<string, unknown>) {
  return supabaseAdmin()
    .from("thank_yous")
    .upsert({ party_id: partyId, person_key: key, ...patch, updated_at: new Date().toISOString() }, { onConflict: "party_id,person_key" });
}

export async function setThanked(slug: string, key: string, thanked: boolean): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const k = cleanKey(key);
  if (!k) return { error: "That person wasn't found." };
  const { error } = await saveThank(party.id, k, { thanked_at: thanked ? new Date().toISOString() : null });
  if (error) return { error: "We couldn't save that. Please try again." };
  return { ok: true };
}

export async function setGiftNote(slug: string, key: string, note: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const k = cleanKey(key);
  if (!k) return { error: "That person wasn't found." };
  const { error } = await saveThank(party.id, k, { gift_note: note.trim().slice(0, 300) || null });
  if (error) return { error: "We couldn't save that. Please try again." };
  return { ok: true };
}

/** Create or update this person's thank-you card and return its link. */
async function upsertCard(party: HostParty, key: string, name: string, message: string) {
  const db = supabaseAdmin();
  const esc = key.replace(/[\\%_]/g, (c) => `\\${c}`);
  // Their design (if any) goes on the inside of the card
  const { data: guest } = await db
    .from("guests")
    .select("id, email, designs(image_path, status)")
    .eq("party_id", party.id)
    .ilike("name", esc)
    .maybeSingle();
  const design = (guest?.designs as unknown as { image_path: string; status: string }[] | null)?.find((d) => d.status === "visible");

  const { data: existing } = await db
    .from("thank_cards")
    .select("token")
    .eq("party_id", party.id)
    .eq("person_key", key)
    .maybeSingle();
  const token = existing?.token ?? newCardToken();
  const now = new Date().toISOString();
  const row = {
    token,
    party_id: party.id,
    person_key: key,
    recipient_name: name.trim().slice(0, 80) || key,
    message: message.trim().slice(0, 5000),
    design_path: design?.image_path ?? null,
    from_name: viewerName(party),
    updated_at: now,
  };
  let { error } = await db.from("thank_cards").upsert(row, { onConflict: "token" });
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    // Database without the from_name column yet: save without the signature
    const { from_name: _skip, ...rest } = row;
    ({ error } = await db.from("thank_cards").upsert(rest, { onConflict: "token" }));
  }
  if (error) throw new Error("We couldn't save the card. Please try again.");
  return { url: `${await siteOrigin()}/c/${token}`, guest };
}

/** Save the card and hand back its private link (to text, or to preview). */
export async function getCardLink(slug: string, key: string, name: string, message: string): Promise<ActionState & { url?: string }> {
  const party = await host(slug);
  if (isState(party)) return party;
  const k = cleanKey(key);
  if (!k || !message.trim()) return { error: "Write a message first." };
  try {
    const { url } = await upsertCard(party, k, name, message);
    return { ok: true, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function emailThankYou(slug: string, key: string, name: string, to: string, message: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const k = cleanKey(key);
  if (!k) return { error: "That person wasn't found." };
  if (!isEmail(to)) return { error: "That email address doesn't look right." };
  if (!message.trim()) return { error: "Write a message first." };
  if (message.length > 5000) return { error: "That message is a bit long." };
  if (!emailConfigured()) return { error: "Email isn't set up yet." };

  let url: string;
  try {
    const card = await upsertCard(party, k, name, message);
    url = card.url;
    // Remember the address on the guest list for next time
    if (card.guest && !card.guest.email) {
      await supabaseAdmin().from("guests").update({ email: to.trim().toLowerCase() }).eq("id", card.guest.id);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }

  try {
    await sendEmails([
      thankYouCardEmail({
        to: to.trim(),
        recipientName: name.trim(),
        fromName: viewerName(party) ?? `${party.guestOfHonorName}'s ${party.occasion.toLowerCase()}`,
        guestOfHonorName: party.guestOfHonorName,
        url,
        replyTo: isEmail(party.viewer.email) ? party.viewer.email : undefined,
      }),
    ]);
  } catch (e) {
    return { error: e instanceof EmailError ? e.message : "The email didn't send. Please try again." };
  }
  const now = new Date().toISOString();
  await saveThank(party.id, k, { emailed_at: now, thanked_at: now });
  return { ok: true, message: "Card sent! Marked as thanked." };
}

// ---------------------------------------------------------------------------
// Co-hosts (the guest of honor, or a helper) with their own dashboard link
// ---------------------------------------------------------------------------

const MAX_CO_HOSTS = 6;

export type CoHostState = ActionState & { url?: string };

export async function inviteCoHost(slug: string, _prev: CoHostState, formData: FormData): Promise<CoHostState> {
  const party = await host(slug);
  if (isState(party)) return party;

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "helper" ? "helper" : "guest_of_honor";
  if (!name) return { error: "Add their name." };
  if (name.length > 80) return { error: "That name is a bit long." };
  if (!isEmail(email) || email.length > 200) return { error: "That email address doesn't look right." };
  if (email === party.hostEmail.toLowerCase()) return { error: "That's the host's email, which already has access." };

  const db = supabaseAdmin();
  const { data: existing, error: listErr } = await db.from("co_hosts").select("id, email").eq("party_id", party.id);
  if (listErr) {
    return {
      error:
        listErr.code === "42P01" || listErr.code === "PGRST205"
          ? "Co-hosts aren't switched on yet (the database update hasn't been run)."
          : "Something went wrong. Please try again.",
    };
  }
  if ((existing ?? []).some((c) => String(c.email).toLowerCase() === email)) {
    return { error: "They're already a co-host. Use \"Email their link again\" below." };
  }
  if ((existing ?? []).length >= MAX_CO_HOSTS) return { error: `A party can have up to ${MAX_CO_HOSTS} co-hosts.` };

  const { data: created, error } = await db
    .from("co_hosts")
    .insert({ party_id: party.id, name, email, role })
    .select("id")
    .single();
  if (error || !created) return { error: "We couldn't add them. Please try again." };

  return sendCoHostLink(party, created.id, name, email, role === "guest_of_honor", true);
}

export async function resendCoHostLink(slug: string, id: string): Promise<CoHostState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!UUID.test(id)) return { error: "That co-host wasn't found." };

  const { data: co } = await supabaseAdmin()
    .from("co_hosts")
    .select("id, name, email, role, link_sent_at")
    .eq("party_id", party.id)
    .eq("id", id)
    .maybeSingle();
  if (!co) return { error: "That co-host wasn't found." };
  if (co.link_sent_at && Date.now() - new Date(co.link_sent_at).getTime() < 60_000) {
    return { error: "A link just went out. Give it a minute to arrive." };
  }
  return sendCoHostLink(party, co.id, co.name, co.email, co.role === "guest_of_honor", false);
}

/** Make a fresh link for a co-host and email it (or hand it back to copy). */
async function sendCoHostLink(
  party: HostParty,
  id: string,
  name: string,
  email: string,
  isGuestOfHonor: boolean,
  isNew: boolean,
): Promise<CoHostState> {
  let url: string;
  try {
    url = `${await siteOrigin()}${await issueCoHostLink(id)}`;
  } catch {
    return { error: "We couldn't make their link. Please try again." };
  }
  refresh(party.slug);

  const first = name.split(" ")[0];
  if (!emailConfigured()) {
    return { ok: true, url, message: `${isNew ? "Added! " : ""}Email isn't set up, so copy ${first}'s link below and send it to them.` };
  }
  try {
    await sendEmails([
      coHostInviteEmail({
        to: email,
        name,
        invitedBy: viewerName(party) ?? "Your host",
        guestOfHonorName: party.guestOfHonorName,
        occasion: party.occasion,
        isGuestOfHonor,
        url,
        replyTo: isEmail(party.viewer.email) ? party.viewer.email : undefined,
      }),
    ]);
  } catch {
    return { ok: true, url, message: `${isNew ? "Added, but t" : "T"}he email didn't send. You can copy ${first}'s link below instead.` };
  }
  return {
    ok: true,
    url,
    message: isNew
      ? `Invite sent to ${email}! ${first}'s link opens the same dashboard you're using.`
      : `A fresh link is on its way to ${email}. Their old link no longer works.`,
  };
}

export async function removeCoHost(slug: string, id: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (party.viewer.kind !== "host") return { error: "Only the host can remove co-hosts." };
  if (!UUID.test(id)) return { error: "That co-host wasn't found." };

  const { error } = await supabaseAdmin().from("co_hosts").delete().eq("party_id", party.id).eq("id", id);
  if (error) return { error: "We couldn't remove them. Please try again." };
  refresh(party.slug);
  return { ok: true, message: "Removed. Their link no longer works." };
}

// ---------------------------------------------------------------------------
// Raffle
// ---------------------------------------------------------------------------

export async function saveRaffle(slug: string, input: { on: boolean; prizes: string[]; rules: RaffleRules }): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;

  const prizes = input.prizes.map((p) => String(p).trim().replace(/\s+/g, " ")).filter(Boolean);
  if (prizes.length > MAX_PRIZES) return { error: `Up to ${MAX_PRIZES} prizes, please.` };
  if (prizes.some((p) => p.length > 80)) return { error: "Keep each prize under 80 characters." };
  const rules: RaffleRules = {
    design: Boolean(input.rules.design),
    note: Boolean(input.rules.note),
    photos: Boolean(input.rules.photos),
    games: Boolean(input.rules.games),
  };
  if (input.on && !prizes.length) return { error: "Add at least one prize." };
  if (input.on && !Object.values(rules).some(Boolean)) return { error: "Pick at least one way to enter." };

  // Keep a prize's winner as long as that prize stays in the list
  const old = party.games.raffle;
  const winners = prizes.map((p) => {
    const i = old.prizes.indexOf(p);
    return i >= 0 ? (old.winners[i] ?? null) : null;
  });
  const res = await saveGames(party, { ...party.games, raffle: { on: Boolean(input.on), prizes, rules, winners } });
  return res.error ? res : { ok: true, message: "Raffle saved." };
}

/** Draw (or redraw) the winner for one prize. Past winners of other prizes can't win twice. */
export async function drawRaffleWinner(slug: string, index: number): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const raffle = party.games.raffle;
  const prize = raffle.prizes[index];
  if (prize === undefined) return { error: "That prize wasn't found." };

  const entrants = raffleEntrants(await listThankYous(party.id), raffle.rules);
  // Redrawing also skips the current winner of this prize (e.g. they couldn't be reached)
  const exclude = new Set(raffle.winners.filter((w): w is NonNullable<typeof w> => Boolean(w)).map((w) => w.key));
  const pick = drawEntrant(entrants, exclude, secureRandom);
  if (!pick) {
    return { error: entrants.length ? "Everyone who entered has already won a prize!" : "Nobody has entered yet." };
  }
  const winners = [...raffle.winners];
  winners[index] = { prize, name: pick.name, key: pick.key, drawnAt: new Date().toISOString(), emailedAt: null };
  const res = await saveGames(party, { ...party.games, raffle: { ...raffle, winners } });
  return res.error ? res : { ok: true, message: `${pick.name} won ${prize}!` };
}

export async function clearRaffleWinner(slug: string, index: number): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const raffle = party.games.raffle;
  if (raffle.prizes[index] === undefined) return { error: "That prize wasn't found." };
  const winners = [...raffle.winners];
  winners[index] = null;
  return saveGames(party, { ...party.games, raffle: { ...raffle, winners } });
}

/**
 * Email the winner. The prize details (a gift card link or code) go straight
 * into the email and are never stored.
 */
export async function emailRaffleWinner(slug: string, index: number, to: string, details: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const raffle = party.games.raffle;
  const w = raffle.winners[index];
  if (!w) return { error: "Draw a winner first." };
  if (!isEmail(to)) return { error: "That email address doesn't look right." };
  if (details.length > 2000) return { error: "Those details are a bit long." };
  if (!emailConfigured()) return { error: "Email isn't set up yet." };

  try {
    await sendEmails([
      raffleWinnerEmail({
        to: to.trim(),
        name: w.name,
        prize: w.prize,
        guestOfHonorName: party.guestOfHonorName,
        occasion: party.occasion,
        details,
        fromName: viewerName(party) ?? `${party.guestOfHonorName}'s ${party.occasion.toLowerCase()}`,
        replyTo: isEmail(party.viewer.email) ? party.viewer.email : undefined,
      }),
    ]);
  } catch (e) {
    return { error: e instanceof EmailError ? e.message : "The email didn't send. Please try again." };
  }
  // Remember their address on the guest list for next time
  const db = supabaseAdmin();
  const { data: g } = await db.from("guests").select("id, email").eq("party_id", party.id).ilike("name", w.name.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle();
  if (g && !g.email) await db.from("guests").update({ email: to.trim().toLowerCase() }).eq("id", g.id);

  const winners = [...raffle.winners];
  winners[index] = { ...w, emailedAt: new Date().toISOString() };
  await saveGames(party, { ...party.games, raffle: { ...raffle, winners } });
  return { ok: true, message: `Sent to ${to.trim()}!` };
}

// ---------------------------------------------------------------------------
// Keepsake reveal for the guest of honor
// ---------------------------------------------------------------------------

export async function saveRevealSettings(slug: string, input: { email: string; auto: boolean }): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const email = input.email.trim().toLowerCase();
  if (email && (!isEmail(email) || email.length > 200)) return { error: "That email address doesn't look right." };
  if (input.auto && !email) return { error: "Add her email so the keepsake can be sent." };
  const { error } = await supabaseAdmin()
    .from("parties")
    .update({ reveal_email: email || null, reveal_auto: Boolean(input.auto) })
    .eq("id", party.id);
  if (error) {
    return { error: error.code === "42703" || error.code === "PGRST204" ? "The keepsake isn't switched on yet (the database update hasn't been run)." : "We couldn't save that. Please try again." };
  }
  refresh(party.slug);
  return { ok: true, message: input.auto ? "Saved! It'll be sent the morning after the party closes." : "Saved." };
}

export async function revealPreviewLink(slug: string): Promise<ActionState & { url?: string }> {
  const party = await host(slug);
  if (isState(party)) return party;
  try {
    const token = await ensureRevealToken(party.id);
    return { ok: true, url: `/r/${token}?preview=1` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function sendRevealNow(slug: string, email: string): Promise<ActionState> {
  const party = await host(slug);
  if (isState(party)) return party;
  const to = email.trim().toLowerCase();
  if (!isEmail(to)) return { error: "Add her email address first." };
  const settings = await getRevealSettings(party.id);
  if (!settings) return { error: "The keepsake isn't switched on yet (the database update hasn't been run)." };
  if (settings.sentAt && Date.now() - new Date(settings.sentAt).getTime() < 60_000) {
    return { error: "It just went out. Give it a minute to arrive." };
  }
  try {
    await supabaseAdmin().from("parties").update({ reveal_email: to }).eq("id", party.id);
    await sendReveal(party, {
      to,
      fromName: viewerName(party) ?? "Your host",
      replyTo: isEmail(party.viewer.email) ? party.viewer.email : undefined,
    });
  } catch (e) {
    return { error: e instanceof EmailError || e instanceof Error ? e.message : "The email didn't send. Please try again." };
  }
  refresh(party.slug);
  return { ok: true, message: `Sent to ${to}! 💛` };
}

// ---------------------------------------------------------------------------
// Download everything
// ---------------------------------------------------------------------------

/** The files to zip (fresh signed links) and the "Open me first" page. */
export async function getDownloadManifest(slug: string, section: DownloadSection): Promise<ActionState & { manifest?: DownloadManifest }> {
  const party = await host(slug);
  if (isState(party)) return party;
  if (!["all", "photos", "guestbook", "designs"].includes(section)) return { error: "Pick what to download." };
  try {
    return { ok: true, manifest: await buildDownload(party, section) };
  } catch (e) {
    console.error("[download] manifest failed", e);
    return { error: "We couldn't gather the files. Please try again." };
  }
}

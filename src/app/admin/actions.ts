"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { emailConfigured, hostLinkEmail, isEmail, sendEmails } from "@/lib/email";
import { PRODUCTS } from "@/lib/gift/products";
import { issueHostLink } from "@/lib/host";
import { siteOrigin } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminState = { ok?: boolean; error?: string; message?: string; hostUrl?: string; slug?: string };

async function guard(): Promise<AdminState | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return { error: "Please sign in to the admin area again." };
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function partyBySlug(slug: string) {
  const { data } = await supabaseAdmin().from("parties").select("id, slug, guest_of_honor_name, occasion, host_email").eq("slug", slug).maybeSingle();
  return data;
}

async function emailHostLink(p: { guest_of_honor_name: string; occasion: string; host_email: string }, url: string) {
  await sendEmails([hostLinkEmail({ to: p.host_email, parties: [{ guestOfHonorName: p.guest_of_honor_name, occasion: p.occasion, url }] })]);
}

export async function createParty(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const denied = await guard();
  if (denied) return denied;

  const name = String(formData.get("guest_of_honor_name") ?? "").trim();
  const occasion = String(formData.get("occasion") ?? "").trim() || "Baby shower";
  const hostEmail = String(formData.get("host_email") ?? "").trim().toLowerCase();
  const hostName = String(formData.get("host_name") ?? "").trim() || null;
  const deadline = String(formData.get("deadline_iso") ?? "");
  const eventDate = String(formData.get("event_date_iso") ?? "") || null;
  const product = String(formData.get("gift_product") ?? "fleece-blanket");
  const sendEmail = formData.get("send_email") === "on";

  if (!name) return { error: "Add the guest of honor's name." };
  if (!isEmail(hostEmail)) return { error: "Add the host's email address." };
  if (!deadline || Number.isNaN(Date.parse(deadline))) return { error: "Set the design deadline." };
  if (!(product in PRODUCTS)) return { error: "Choose the gift product." };

  const base = slugify(String(formData.get("slug") ?? "")) || slugify(`${name}-${occasion.split(" ")[0]}`) || "party";
  const db = supabaseAdmin();
  let slug = base.length >= 3 ? base : `${base}-party`;
  for (let i = 0; i < 5; i++) {
    const { data: taken } = await db.from("parties").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: created, error } = await db
    .from("parties")
    .insert({
      slug,
      guest_of_honor_name: name,
      occasion,
      host_email: hostEmail,
      host_name: hostName,
      deadline: new Date(deadline).toISOString(),
      event_date: eventDate ? new Date(eventDate).toISOString() : null,
      gift_product: product,
      status: "collecting",
    })
    .select("id, slug, guest_of_honor_name, occasion, host_email")
    .single();
  if (error || !created) return { error: `We couldn't create the party (${error?.message ?? "unknown error"}).` };

  const hostUrl = `${await siteOrigin()}${await issueHostLink(created.id)}`;
  let message = "Party created.";
  if (sendEmail) {
    if (!emailConfigured()) message += " Email isn't set up yet, so copy the host link below and send it yourself.";
    else {
      try {
        await emailHostLink(created, hostUrl);
        message += ` The host link was emailed to ${hostEmail}.`;
      } catch {
        message += " The email didn't send, so copy the host link below and send it yourself.";
      }
    }
  }
  revalidatePath("/admin");
  return { ok: true, message, hostUrl, slug: created.slug };
}

export async function newHostLink(slug: string, email: boolean): Promise<AdminState> {
  const denied = await guard();
  if (denied) return denied;
  const p = await partyBySlug(slug);
  if (!p) return { error: "Party not found." };
  const hostUrl = `${await siteOrigin()}${await issueHostLink(p.id)}`;
  if (email) {
    if (!emailConfigured()) return { ok: true, hostUrl, message: "Email isn't set up yet. Copy the link and send it yourself." };
    try {
      await emailHostLink(p, hostUrl);
    } catch {
      return { ok: true, hostUrl, message: "The email didn't send. Copy the link and send it yourself." };
    }
    return { ok: true, hostUrl, message: `New link emailed to ${p.host_email}. The old link no longer works.` };
  }
  return { ok: true, hostUrl, message: "New host link made. The old link no longer works." };
}

export async function setStatus(slug: string, status: "collecting" | "printing" | "shipped"): Promise<AdminState> {
  const denied = await guard();
  if (denied) return denied;
  const { error } = await supabaseAdmin().from("parties").update({ status }).eq("slug", slug);
  if (error) return { error: "Couldn't update the status." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function updatePartyAdmin(slug: string, _prev: AdminState, formData: FormData): Promise<AdminState> {
  const denied = await guard();
  if (denied) return denied;
  const hostEmail = String(formData.get("host_email") ?? "").trim().toLowerCase();
  const hostName = String(formData.get("host_name") ?? "").trim() || null;
  const product = String(formData.get("gift_product") ?? "");
  const extras = formData.getAll("extra_products").map(String).filter((k) => k in PRODUCTS && k !== product);
  if (!isEmail(hostEmail)) return { error: "That host email doesn't look right." };
  if (!(product in PRODUCTS)) return { error: "Choose the gift product." };

  const { error } = await supabaseAdmin()
    .from("parties")
    .update({ host_email: hostEmail, host_name: hostName, gift_product: product, extra_products: extras })
    .eq("slug", slug);
  if (error) return { error: "Couldn't save those changes." };
  revalidatePath("/admin", "layout");
  revalidatePath(`/host/${slug}`, "layout");
  return { ok: true, message: "Saved." };
}

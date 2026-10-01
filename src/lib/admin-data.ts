import "server-only";
import { PRODUCTS, ownedProducts, type ProductKey } from "@/lib/gift/products";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";

export type FulfilmentStatus = "collecting" | "designing" | "ready" | "printing" | "shipped";

export const STAGE_LABEL: Record<FulfilmentStatus, string> = {
  collecting: "Collecting designs",
  designing: "Host designing",
  ready: "Ready to print",
  printing: "Printing",
  shipped: "Shipped",
};

export type PartySummary = {
  id: string;
  slug: string;
  guestOfHonorName: string;
  occasion: string;
  hostEmail: string;
  hostName: string | null;
  createdAt: string;
  deadline: string;
  eventDate: string | null;
  isOpen: boolean;
  status: string;
  products: { key: ProductKey; name: string; final: boolean }[];
  counts: { guests: number; designs: number; photos: number; notes: number };
  stage: FulfilmentStatus;
};

/** Count rows per party for a table (fine at our size; one query per table). */
async function countBy(table: string, extra?: (q: any) => any): Promise<Map<string, number>> {
  let q = supabaseAdmin().from(table).select("party_id").limit(50000);
  if (extra) q = extra(q);
  const { data } = await q;
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { party_id: string }[]) m.set(r.party_id, (m.get(r.party_id) ?? 0) + 1);
  return m;
}

export function stageFor(p: { status: string; isOpen: boolean; products: { final: boolean }[] }): FulfilmentStatus {
  if (p.status === "shipped") return "shipped";
  if (p.status === "printing") return "printing";
  if (p.products.length && p.products.every((x) => x.final)) return "ready";
  if (!p.isOpen) return "designing";
  return "collecting";
}

export async function listPartySummaries(): Promise<PartySummary[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("parties").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) throw dbError("loading parties", error);

  const [guests, designs, photos, notes, gifts] = await Promise.all([
    countBy("guests"),
    countBy("designs", (q) => q.eq("status", "visible")),
    countBy("photos", (q) => q.eq("status", "visible")),
    countBy("messages", (q) => q.eq("status", "visible")),
    db.from("gift_designs").select("party_id, product_key, status").limit(50000),
  ]);
  const finals = new Set(
    ((gifts.data ?? []) as { party_id: string; product_key: string; status: string }[])
      .filter((g) => g.status === "final")
      .map((g) => `${g.party_id}:${g.product_key}`),
  );

  return (data ?? []).map((p) => {
    const keys = ownedProducts(p.gift_product ?? "fleece-blanket", Array.isArray(p.extra_products) ? p.extra_products : []);
    const products = keys.map((k) => ({ key: k, name: PRODUCTS[k].name, final: finals.has(`${p.id}:${k}`) }));
    const isOpen = new Date(p.deadline).getTime() > Date.now();
    const summary = {
      id: p.id,
      slug: p.slug,
      guestOfHonorName: p.guest_of_honor_name,
      occasion: p.occasion,
      hostEmail: p.host_email,
      hostName: p.host_name,
      createdAt: p.created_at,
      deadline: p.deadline,
      eventDate: p.event_date ?? null,
      isOpen,
      status: p.status,
      products,
      counts: {
        guests: guests.get(p.id) ?? 0,
        designs: designs.get(p.id) ?? 0,
        photos: photos.get(p.id) ?? 0,
        notes: notes.get(p.id) ?? 0,
      },
    };
    return { ...summary, stage: stageFor(summary) };
  });
}

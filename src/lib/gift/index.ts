import "server-only";
import { DESIGNS_BUCKET, dbError, supabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeLayout, type Layout } from "./layout";
import type { ProductKey } from "./products";

export const PRINTS_BUCKET = "prints";

export type GiftDesignSource = {
  designId: string;
  guestName: string;
  url: string | null;
  width: number;
  height: number;
};

/** Every visible guest design, ready to place on the gift. */
export async function listGiftSources(partyId: string): Promise<GiftDesignSource[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("designs")
    .select("id, image_path, width, height, status, guests(name)")
    .eq("party_id", partyId)
    .eq("status", "visible")
    .order("created_at");
  if (error) throw dbError("loading designs for the gift", error);
  const rows = data ?? [];
  const urls = new Map<string, string>();
  if (rows.length) {
    const { data: signed } = await db.storage.from(DESIGNS_BUCKET).createSignedUrls(
      rows.map((r) => r.image_path),
      60 * 60 * 6,
    );
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    designId: r.id,
    guestName: (r.guests as unknown as { name: string } | null)?.name ?? "Guest",
    url: urls.get(r.image_path) ?? null,
    width: r.width ?? 1000,
    height: r.height ?? 1000,
  }));
}

export type SavedGift = {
  productKey: ProductKey;
  layout: Layout;
  status: "draft" | "final";
  printUrl: string | null;
  finalizedAt: string | null;
  updatedAt: string;
};

export async function listSavedGifts(partyId: string): Promise<SavedGift[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("gift_designs").select("*").eq("party_id", partyId);
  if (error) throw dbError("loading gift designs", error);
  const out: SavedGift[] = [];
  for (const r of data ?? []) {
    let printUrl: string | null = null;
    if (r.print_path) {
      const { data: s } = await db.storage.from(PRINTS_BUCKET).createSignedUrl(r.print_path, 60 * 60, { download: true });
      printUrl = s?.signedUrl ?? null;
    }
    out.push({
      productKey: r.product_key,
      layout: sanitizeLayout(r.layout),
      status: r.status,
      printUrl,
      finalizedAt: r.finalized_at,
      updatedAt: r.updated_at,
    });
  }
  return out;
}

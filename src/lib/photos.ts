import "server-only";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";
import { isBoothPrompt, type BoothPrompt } from "@/lib/booth/prompts";

export const PHOTOS_BUCKET = "photos";
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export type Photo = {
  id: string;
  authorName: string;
  caption: string | null;
  /** Photo booth: what they wrote, and which prompt they answered */
  prompt: BoothPrompt | null;
  story: string | null;
  url: string | null;
  /** Full-quality original (host view only) */
  originalUrl?: string | null;
  width: number | null;
  height: number | null;
  hearts: number;
  hearted: boolean;
  hidden: boolean;
  mine: boolean;
  createdAt: string;
};

export async function listPhotos(
  partyId: string,
  opts: { includeHidden?: boolean; deviceHash?: string | null; withOriginals?: boolean; limit?: number } = {},
): Promise<Photo[]> {
  const db = supabaseAdmin();
  let q = db
    .from("photos")
    .select("*, photo_hearts(device_hash)")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 1000);
  q = opts.includeHidden ? q.in("status", ["visible", "hidden"]) : q.eq("status", "visible");
  const { data, error } = await q;
  if (error) throw dbError("loading photos", error);
  const rows = data ?? [];

  const paths = rows.map((r) => r.image_path as string);
  if (opts.withOriginals) paths.push(...rows.map((r) => r.original_path as string));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, 60 * 60 * 3);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((r) => {
    const hearts = (r.photo_hearts as unknown as { device_hash: string }[] | null) ?? [];
    return {
      id: r.id,
      authorName: r.author_name,
      caption: r.caption,
      prompt: isBoothPrompt(r.prompt) ? r.prompt : null,
      story: r.story ?? null,
      url: urls.get(r.image_path) ?? null,
      originalUrl: opts.withOriginals ? (urls.get(r.original_path) ?? null) : undefined,
      width: r.width,
      height: r.height,
      hearts: hearts.length,
      hearted: Boolean(opts.deviceHash && hearts.some((h) => h.device_hash === opts.deviceHash)),
      hidden: r.status === "hidden",
      mine: Boolean(opts.deviceHash && r.device_hash === opts.deviceHash),
      createdAt: r.created_at,
    };
  });
}

/** Photo count and a couple of recent shots for the party page. */
export async function albumPreview(partyId: string): Promise<{ count: number; urls: string[] }> {
  const db = supabaseAdmin();
  const { data, count, error } = await db
    .from("photos")
    .select("image_path", { count: "exact" })
    .eq("party_id", partyId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(2);
  if (error || !data?.length) return { count: 0, urls: [] };
  const { data: signed } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(
    data.map((d) => d.image_path),
    60 * 60,
  );
  return { count: count ?? data.length, urls: (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[] };
}

export async function removePhotoFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await supabaseAdmin().storage.from(PHOTOS_BUCKET).remove(list);
}

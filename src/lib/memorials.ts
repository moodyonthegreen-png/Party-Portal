import "server-only";
import { MEDIA_BUCKET } from "@/lib/messages";
import { PHOTOS_BUCKET } from "@/lib/photos";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Memorial notes: the host honors loved ones who have passed. They open the
 * guest book, ahead of every guest's note, and get a page in the keepsake.
 */
export type Memorial = {
  id: string;
  name: string;
  /** Who they are to the guest of honor, e.g. "Jessica's mom" */
  relation: string | null;
  message: string | null;
  mediaKind: "photo" | "audio" | "video" | null;
  mediaUrl: string | null;
};

export const MAX_MEMORIALS = 6;
export const MEMORIAL_SUGGESTION = "Here with us in spirit.";

export const memorialBucket = (kind: "photo" | "audio" | "video") => (kind === "photo" ? PHOTOS_BUCKET : MEDIA_BUCKET);

/** ready = false until the database update for memorials has been run */
export async function listMemorials(partyId: string): Promise<{ ready: boolean; items: Memorial[] }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("memorials")
    .select("id, name, relation, message, media_kind, media_path, sort, created_at")
    .eq("party_id", partyId)
    .order("sort")
    .order("created_at");
  if (error) return { ready: false, items: [] };

  const rows = data ?? [];
  const urls = new Map<string, string>();
  for (const kind of ["photo", "media"] as const) {
    const paths = rows
      .filter((r) => r.media_path && (kind === "photo" ? r.media_kind === "photo" : r.media_kind !== "photo"))
      .map((r) => r.media_path as string);
    if (!paths.length) continue;
    const { data: signed } = await db.storage.from(kind === "photo" ? PHOTOS_BUCKET : MEDIA_BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return {
    ready: true,
    items: rows.map((r) => {
      const url = r.media_path ? (urls.get(r.media_path as string) ?? null) : null;
      return {
        id: r.id as string,
        name: r.name as string,
        relation: (r.relation as string | null) ?? null,
        message: (r.message as string | null) ?? null,
        mediaKind: url ? ((r.media_kind as Memorial["mediaKind"]) ?? null) : null,
        mediaUrl: url,
      };
    }),
  };
}

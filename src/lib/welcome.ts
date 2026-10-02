import "server-only";
import { MEDIA_BUCKET } from "@/lib/messages";
import { PHOTOS_BUCKET } from "@/lib/photos";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** The welcome on the guest home page: a video and photos from the host or guest of honor. */
export type Welcome = {
  video: { url: string; by: string | null } | null;
  photos: { id: string; url: string; caption: string | null }[];
  /** False until the database update for welcome videos/photos has been run */
  ready: boolean;
};

export const MAX_WELCOME_PHOTOS = 12;

export async function getWelcome(partyId: string): Promise<Welcome> {
  const db = supabaseAdmin();
  const [party, photos] = await Promise.all([
    db.from("parties").select("*").eq("id", partyId).single(),
    db.from("welcome_photos").select("id, image_path, caption, sort, created_at").eq("party_id", partyId).order("sort").order("created_at"),
  ]);
  const ready = !photos.error && party.data != null && "welcome_video_path" in party.data;

  let video: Welcome["video"] = null;
  const path = party.data?.welcome_video_path as string | null | undefined;
  if (path) {
    const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 6);
    if (data?.signedUrl) video = { url: data.signedUrl, by: (party.data?.welcome_video_by as string | null) ?? null };
  }

  const rows = photos.error ? [] : (photos.data ?? []);
  let list: Welcome["photos"] = [];
  if (rows.length) {
    const { data: signed } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(
      rows.map((r) => r.image_path as string),
      60 * 60 * 6,
    );
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    list = rows
      .map((r) => ({ id: r.id as string, url: byPath.get(r.image_path) ?? "", caption: (r.caption as string | null) ?? null }))
      .filter((p) => p.url);
  }
  return { video, photos: list, ready };
}

import "server-only";
import { dbError, supabaseAdmin } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "media";

/** Accepted voice memo / video formats and the file extension we store them with. */
export const MEDIA_TYPES: Record<string, { kind: "audio" | "video"; ext: string }> = {
  "audio/webm": { kind: "audio", ext: "webm" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/x-m4a": { kind: "audio", ext: "m4a" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "video/webm": { kind: "video", ext: "webm" },
};

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export type Message = {
  id: string;
  authorName: string;
  body: string | null;
  mediaType: "audio" | "video" | null;
  mediaUrl: string | null;
  hidden: boolean;
  createdAt: string;
  /** True when this browser posted it (guests can delete their own) */
  mine: boolean;
};

export async function listMessages(
  partyId: string,
  opts: { includeHidden?: boolean; deviceHash?: string | null } = {},
): Promise<Message[]> {
  const db = supabaseAdmin();
  let q = db
    .from("messages")
    .select("id, author_name, body, media_path, media_type, status, device_hash, created_at")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false })
    .limit(500);
  q = opts.includeHidden ? q.in("status", ["visible", "hidden"]) : q.eq("status", "visible");
  const { data, error } = await q;
  if (error) throw dbError("loading messages", error);

  const rows = data ?? [];
  const paths = rows.map((r) => r.media_path as string | null).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60 * 3);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    body: r.body,
    mediaType: r.media_type,
    mediaUrl: r.media_path ? (urls.get(r.media_path) ?? null) : null,
    hidden: r.status === "hidden",
    createdAt: r.created_at,
    mine: Boolean(opts.deviceHash && r.device_hash === opts.deviceHash),
  }));
}

export async function countMessages(partyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("party_id", partyId)
    .eq("status", "visible");
  if (error) return 0;
  return count ?? 0;
}

export async function removeMessageMedia(path: string | null) {
  if (path) await supabaseAdmin().storage.from(MEDIA_BUCKET).remove([path]);
}

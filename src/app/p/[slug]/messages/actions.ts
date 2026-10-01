"use server";

import { revalidatePath } from "next/cache";
import { ensureDeviceHash } from "@/lib/device";
import { MAX_MEDIA_BYTES, MEDIA_BUCKET, MEDIA_TYPES, removeMessageMedia } from "@/lib/messages";
import { getParty, hasPartyAccess, type PublicParty } from "@/lib/parties";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

export type PostResult =
  | { ok: true; id: string; upload: { path: string; token: string } | null }
  | Fail;

async function openBoard(slug: string): Promise<PublicParty | Fail> {
  const party = await getParty(slug);
  if (!party) return fail("We couldn't find this party.");
  if (!(await hasPartyAccess(party))) return fail("Please enter the party password first.");
  if (!party.sections.messages) return fail("The message board isn't part of this party.");
  return party;
}

function refresh(slug: string) {
  revalidatePath(`/p/${slug}`, "layout");
  revalidatePath(`/host/${slug}`, "layout");
}

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Post a note. With a voice memo or video, the note is saved as "pending"
 * and we hand back a signed upload link; finishMessage() publishes it once
 * the file has arrived.
 */
export async function postMessage(
  slug: string,
  input: { name: string; body: string; media: { mime: string; size: number } | null },
): Promise<PostResult> {
  const party = await openBoard(slug);
  if ("ok" in party) return party;

  const name = input.name.trim().replace(/\s+/g, " ");
  const body = input.body.trim();
  if (!name) return fail("Please add your name.");
  if (name.length > 80) return fail("That name is a bit long.");
  if (body.length > 1500) return fail("That note is a little long. Please keep it under 1,500 characters.");
  if (!body && !input.media) return fail("Write a note, or add a voice memo or video.");

  let media: { kind: "audio" | "video"; ext: string } | null = null;
  if (input.media) {
    const base = input.media.mime.split(";")[0].trim().toLowerCase();
    media = MEDIA_TYPES[base] ?? null;
    if (!media) return fail("That kind of file isn't supported. Try recording again or choose a different video.");
    if (input.media.size > MAX_MEDIA_BYTES) {
      return fail("That video is too big (the limit is 50 MB). Try a shorter clip, around 30 seconds.");
    }
  }

  const db = supabaseAdmin();
  const id = crypto.randomUUID();
  const mediaPath = media ? `${party.id}/${id}.${media.ext}` : null;

  const { error } = await db.from("messages").insert({
    id,
    party_id: party.id,
    author_name: name,
    body: body || null,
    media_path: mediaPath,
    media_type: media?.kind ?? null,
    device_hash: await ensureDeviceHash(party),
    status: media ? "pending" : "visible",
  });
  if (error) return fail("We couldn't post your note. Please try again.");

  let upload: { path: string; token: string } | null = null;
  if (mediaPath) {
    const { data, error: upErr } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(mediaPath);
    if (upErr || !data) {
      await db.from("messages").delete().eq("id", id);
      return fail("We couldn't get ready to upload. Please try again.");
    }
    upload = { path: data.path, token: data.token };
  } else {
    refresh(party.slug);
  }

  return { ok: true, id, upload };
}

/** Publish a note once its voice memo or video has uploaded. */
export async function finishMessage(slug: string, id: string): Promise<{ ok: true } | Fail> {
  const party = await openBoard(slug);
  if ("ok" in party) return party;
  if (!UUID.test(id)) return fail("That note wasn't found.");

  const db = supabaseAdmin();
  const deviceHash = await ensureDeviceHash(party);
  const { data: msg } = await db
    .from("messages")
    .select("id, media_path, device_hash, status")
    .eq("id", id)
    .eq("party_id", party.id)
    .maybeSingle();
  if (!msg || msg.device_hash !== deviceHash || !msg.media_path) return fail("That note wasn't found.");

  // Make sure the file really arrived
  const fileName = String(msg.media_path).split("/").pop()!;
  const { data: files } = await db.storage.from(MEDIA_BUCKET).list(party.id, { search: fileName, limit: 5 });
  if (!files?.some((f) => f.name === fileName)) return fail("Your recording didn't finish uploading. Please try again.");

  if (msg.status === "pending") {
    await db.from("messages").update({ status: "visible" }).eq("id", id);
  }
  refresh(party.slug);
  return { ok: true };
}

/** Guests can delete notes they posted from this browser. */
export async function deleteMyMessage(slug: string, id: string): Promise<{ ok: true } | Fail> {
  const party = await openBoard(slug);
  if ("ok" in party) return party;
  if (!UUID.test(id)) return fail("That note wasn't found.");

  const db = supabaseAdmin();
  const deviceHash = await ensureDeviceHash(party);
  const { data: msg } = await db
    .from("messages")
    .select("id, media_path, device_hash")
    .eq("id", id)
    .eq("party_id", party.id)
    .maybeSingle();
  if (!msg || msg.device_hash !== deviceHash) return fail("You can only delete notes you posted from this device.");

  await removeMessageMedia(msg.media_path);
  await db.from("messages").delete().eq("id", id);
  refresh(party.slug);
  return { ok: true };
}

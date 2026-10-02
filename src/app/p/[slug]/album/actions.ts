"use server";

import { revalidatePath } from "next/cache";
import { ensureDeviceHash } from "@/lib/device";
import { getParty, hasPartyAccess, type PublicParty } from "@/lib/parties";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, PHOTOS_BUCKET, removePhotoFiles } from "@/lib/photos";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const UUID = /^[0-9a-f-]{36}$/i;

export type StartPhotoResult =
  | { ok: true; id: string; display: { path: string; token: string }; original: { path: string; token: string } }
  | Fail;

async function openAlbum(slug: string): Promise<PublicParty | Fail> {
  const party = await getParty(slug);
  if (!party) return fail("We couldn't find this party.");
  if (!(await hasPartyAccess(party))) return fail("Please enter the party password first.");
  if (!party.sections.album) return fail("The photo album isn't part of this party.");
  return party;
}

function refresh(slug: string) {
  revalidatePath(`/p/${slug}`, "layout");
  revalidatePath(`/host/${slug}`, "layout");
}

/**
 * Step 1 for each photo: save it as "pending" and hand back two signed
 * upload links, one for the resized album copy and one for the original.
 */
export async function startPhoto(
  slug: string,
  input: {
    name: string;
    caption: string;
    originalMime: string;
    originalSize: number;
    /** Photo booth answers (optional) */
    prompt?: "intro" | "memory" | null;
    story?: string;
  },
): Promise<StartPhotoResult> {
  const party = await openAlbum(slug);
  if ("ok" in party) return party;

  const name = input.name.trim().replace(/\s+/g, " ");
  const caption = input.caption.trim();
  if (!name) return fail("Please add your name.");
  if (name.length > 80) return fail("That name is a bit long.");
  if (caption.length > 200) return fail("Captions can be up to 200 characters.");
  const story = (input.story ?? "").trim();
  if (story.length > 600) return fail("Please keep it under 600 characters.");
  const prompt = story && (input.prompt === "intro" || input.prompt === "memory") ? input.prompt : null;

  const ext = PHOTO_TYPES[input.originalMime.toLowerCase()];
  if (!ext) return fail("That kind of file isn't supported. Try a JPEG or PNG photo.");
  if (input.originalSize > MAX_PHOTO_BYTES) return fail("That photo is too large (the limit is 25 MB).");

  const db = supabaseAdmin();
  const id = crypto.randomUUID();
  const imagePath = `${party.id}/${id}.jpg`;
  const originalPath = `${party.id}/${id}-original.${ext}`;

  const { error } = await db.from("photos").insert({
    id,
    party_id: party.id,
    author_name: name,
    caption: caption || null,
    ...(story ? { story, prompt } : {}),
    image_path: imagePath,
    original_path: originalPath,
    device_hash: await ensureDeviceHash(party),
    status: "pending",
  });
  if (error) return fail("We couldn't add your photo. Please try again.");

  const bucket = db.storage.from(PHOTOS_BUCKET);
  const [display, original] = await Promise.all([
    bucket.createSignedUploadUrl(imagePath),
    bucket.createSignedUploadUrl(originalPath),
  ]);
  if (!display.data || !original.data) {
    await db.from("photos").delete().eq("id", id);
    return fail("We couldn't get ready to upload. Please try again.");
  }

  return {
    ok: true,
    id,
    display: { path: display.data.path, token: display.data.token },
    original: { path: original.data.path, token: original.data.token },
  };
}

/** Step 2: both files uploaded, so show the photo in the album. */
export async function finishPhoto(
  slug: string,
  id: string,
  size: { width: number; height: number },
): Promise<{ ok: true } | Fail> {
  const party = await openAlbum(slug);
  if ("ok" in party) return party;
  if (!UUID.test(id)) return fail("That photo wasn't found.");

  const db = supabaseAdmin();
  const deviceHash = await ensureDeviceHash(party);
  const { data: photo } = await db
    .from("photos")
    .select("id, image_path, original_path, device_hash")
    .eq("id", id)
    .eq("party_id", party.id)
    .maybeSingle();
  if (!photo || photo.device_hash !== deviceHash) return fail("That photo wasn't found.");

  const { data: files } = await db.storage.from(PHOTOS_BUCKET).list(party.id, { search: id, limit: 5 });
  const names = new Set((files ?? []).map((f) => `${party.id}/${f.name}`));
  if (!names.has(photo.image_path) || !names.has(photo.original_path)) {
    return fail("Your photo didn't finish uploading. Please try again.");
  }

  await db
    .from("photos")
    .update({ status: "visible", width: Math.round(size.width) || null, height: Math.round(size.height) || null })
    .eq("id", id)
    .eq("status", "pending");
  refresh(party.slug);
  return { ok: true };
}

/** Guests can delete photos they added from this browser. */
export async function deleteMyPhoto(slug: string, id: string): Promise<{ ok: true } | Fail> {
  const party = await openAlbum(slug);
  if ("ok" in party) return party;
  if (!UUID.test(id)) return fail("That photo wasn't found.");

  const db = supabaseAdmin();
  const deviceHash = await ensureDeviceHash(party);
  const { data: photo } = await db
    .from("photos")
    .select("id, image_path, original_path, device_hash")
    .eq("id", id)
    .eq("party_id", party.id)
    .maybeSingle();
  if (!photo || photo.device_hash !== deviceHash) return fail("You can only delete photos you added from this device.");

  await removePhotoFiles([photo.image_path, photo.original_path]);
  await db.from("photos").delete().eq("id", id);
  refresh(party.slug);
  return { ok: true };
}

/** Heart or un-heart a photo. Returns the new count. */
export async function toggleHeart(slug: string, id: string): Promise<{ ok: true; hearted: boolean; hearts: number } | Fail> {
  const party = await openAlbum(slug);
  if ("ok" in party) return party;
  if (!UUID.test(id)) return fail("That photo wasn't found.");

  const db = supabaseAdmin();
  const { data: photo } = await db
    .from("photos")
    .select("id")
    .eq("id", id)
    .eq("party_id", party.id)
    .eq("status", "visible")
    .maybeSingle();
  if (!photo) return fail("That photo wasn't found.");

  const deviceHash = await ensureDeviceHash(party);
  const { data: existing } = await db
    .from("photo_hearts")
    .select("photo_id")
    .eq("photo_id", id)
    .eq("device_hash", deviceHash)
    .maybeSingle();

  if (existing) {
    await db.from("photo_hearts").delete().eq("photo_id", id).eq("device_hash", deviceHash);
  } else {
    await db.from("photo_hearts").insert({ photo_id: id, device_hash: deviceHash });
  }

  const { count } = await db.from("photo_hearts").select("photo_id", { count: "exact", head: true }).eq("photo_id", id);
  return { ok: true, hearted: !existing, hearts: count ?? 0 };
}

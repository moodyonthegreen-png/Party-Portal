"use server";

import { revalidatePath } from "next/cache";
import { ensureDeviceHash } from "@/lib/device";
import { getParty, hasPartyAccess, type PublicParty } from "@/lib/parties";
import { DESIGNS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";

type Fail = { ok: false; error: string };

export type StartUploadResult =
  | {
      ok: true;
      guestId: string;
      version: string;
      design: { path: string; token: string };
      original: { path: string; token: string };
    }
  | Fail;

export type FinishUploadResult = { ok: true } | Fail;

const fail = (error: string): Fail => ({ ok: false, error });

/** Shared checks for every guest upload action. */
async function openPartyFor(slug: string): Promise<PublicParty | Fail> {
  const party = await getParty(slug);
  if (!party) return fail("We couldn't find this party.");
  if (!(await hasPartyAccess(party))) return fail("Please enter the party password first.");
  if (!party.sections.design) return fail("Designs aren't part of this party.");
  if (!party.isOpen) return fail("The deadline has passed, so designs are closed.");
  return party;
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Step 1: find or create the guest, check this browser may (re)place their
 * design, and hand back signed upload URLs. The browser uploads the files
 * straight to Supabase Storage, which avoids Vercel's 4.5 MB request limit.
 */
export async function startDesignUpload(slug: string, rawName: string): Promise<StartUploadResult> {
  const party = await openPartyFor(slug);
  if ("ok" in party) return party;

  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return fail("Please add your name.");
  if (name.length > 80) return fail("That name is a bit long. Try a shorter version.");

  const db = supabaseAdmin();
  const deviceHash = await ensureDeviceHash(party);

  const { data: found, error: findErr } = await db
    .from("guests")
    .select("id, claim_token_hash")
    .eq("party_id", party.id)
    .ilike("name", escapeLike(name))
    .maybeSingle();
  if (findErr) return fail("Something went wrong. Please try again.");

  let guestId: string;
  if (found) {
    if (found.claim_token_hash && found.claim_token_hash !== deviceHash) {
      return fail(
        `A design has already been added for ${name} from another phone or computer. Use that device to replace it, or ask the host for help.`,
      );
    }
    guestId = found.id;
    if (!found.claim_token_hash) {
      await db.from("guests").update({ claim_token_hash: deviceHash }).eq("id", guestId);
    }
  } else {
    if (party.requireGuestList) {
      return fail("Please choose your name from the list. If it's missing, let the host know.");
    }
    const { data: created, error: createErr } = await db
      .from("guests")
      .insert({ party_id: party.id, name, added_by: "guest", claim_token_hash: deviceHash })
      .select("id")
      .single();
    if (createErr || !created) return fail("We couldn't save your name. Please try again.");
    guestId = created.id;
  }

  // New file names on every upload so replaced images never show from cache
  const version = crypto.randomUUID();
  const base = `${party.id}/${guestId}/${version}`;
  const bucket = db.storage.from(DESIGNS_BUCKET);
  const [design, original] = await Promise.all([
    bucket.createSignedUploadUrl(`${base}-design.png`),
    bucket.createSignedUploadUrl(`${base}-original.jpg`),
  ]);
  if (!design.data || !original.data) return fail("We couldn't get ready to upload. Please try again.");

  return {
    ok: true,
    guestId,
    version,
    design: { path: design.data.path, token: design.data.token },
    original: { path: original.data.path, token: original.data.token },
  };
}

/**
 * Step 2: after both files are uploaded, record the design (replacing any
 * earlier one for this guest) and clean up the old files.
 */
export async function finishDesignUpload(
  slug: string,
  input: {
    guestId: string;
    version: string;
    width: number;
    height: number;
    source: "photo" | "drawn";
    blurScore: number | null;
  },
): Promise<FinishUploadResult> {
  const party = await openPartyFor(slug);
  if ("ok" in party) return party;

  if (!/^[0-9a-f-]{36}$/i.test(input.version) || !/^[0-9a-f-]{36}$/i.test(input.guestId)) {
    return fail("That upload didn't look right. Please try again.");
  }

  const db = supabaseAdmin();
  const deviceHash = await ensureDeviceHash(party);
  const { data: guest } = await db
    .from("guests")
    .select("id, claim_token_hash")
    .eq("id", input.guestId)
    .eq("party_id", party.id)
    .maybeSingle();
  if (!guest || guest.claim_token_hash !== deviceHash) {
    return fail("We couldn't match this upload to you. Please start again.");
  }

  const folder = `${party.id}/${guest.id}`;
  const designPath = `${folder}/${input.version}-design.png`;
  const originalPath = `${folder}/${input.version}-original.jpg`;

  // Make sure both files really arrived
  const bucket = db.storage.from(DESIGNS_BUCKET);
  const { data: files, error: listErr } = await bucket.list(folder, { limit: 100 });
  if (listErr || !files) return fail("Something went wrong. Please try again.");
  const names = new Set(files.map((f) => f.name));
  if (!names.has(`${input.version}-design.png`) || !names.has(`${input.version}-original.jpg`)) {
    return fail("Your photo didn't finish uploading. Please try again.");
  }

  const { error: upsertErr } = await db.from("designs").upsert(
    {
      party_id: party.id,
      guest_id: guest.id,
      image_path: designPath,
      original_path: originalPath,
      width: Math.round(input.width) || null,
      height: Math.round(input.height) || null,
      source: input.source === "drawn" ? "drawn" : "photo",
      blur_score: Number.isFinite(input.blurScore) ? input.blurScore : null,
      status: "visible",
    },
    { onConflict: "party_id,guest_id" },
  );
  if (upsertErr) return fail("We couldn't save your design. Please try again.");

  // Remove earlier versions for this guest
  const stale = files.map((f) => f.name).filter((n) => !n.startsWith(input.version)).map((n) => `${folder}/${n}`);
  if (stale.length) await bucket.remove(stale);

  revalidatePath(`/p/${party.slug}/design`);
  return { ok: true };
}

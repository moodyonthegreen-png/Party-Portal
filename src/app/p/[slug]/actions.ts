"use server";

import { redirect } from "next/navigation";
import { checkPartyPassword, getParty, grantPartyAccess } from "@/lib/parties";

export type UnlockState = { error?: string };

export async function unlockParty(
  slug: string,
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const party = await getParty(slug);
  if (!party) return { error: "We couldn't find that party." };

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Please enter the party password." };

  if (!(await checkPartyPassword(party.slug, password))) {
    return { error: "That password doesn't match. Check your invitation and try again." };
  }

  await grantPartyAccess(party);
  redirect(`/p/${party.slug}`);
}

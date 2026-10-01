import "server-only";
import { cookies } from "next/headers";
import type { PublicParty } from "@/lib/parties";

/**
 * Each browser gets a random "device" token per party, stored in an httpOnly
 * cookie. Guests a browser has uploaded for are tied to a hash of that token,
 * so the same browser can replace those designs later and nobody else can.
 * One browser can hold several guests (a parent adding the kids' designs).
 */

const cookieName = (slug: string) => `pp_device_${slug}`;

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

/** Hash of this browser's token, or null if it has never uploaded. */
export async function currentDeviceHash(party: PublicParty): Promise<string | null> {
  const token = (await cookies()).get(cookieName(party.slug))?.value;
  return token ? sha256(token) : null;
}

/** Returns this browser's token hash, creating the token if needed. */
export async function ensureDeviceHash(party: PublicParty): Promise<string> {
  const jar = await cookies();
  let token = jar.get(cookieName(party.slug))?.value;
  if (!token) {
    token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
    jar.set(cookieName(party.slug), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/p/${party.slug}`,
      // Long enough to outlast any party deadline
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return sha256(token);
}

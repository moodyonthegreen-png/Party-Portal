import "server-only";
import { cookies } from "next/headers";
import { sha256 } from "@/lib/device";

/**
 * Moody Celebrations admin access. Sign-in uses ADMIN_PASSWORD (set in
 * Vercel). The cookie holds a hash of the password plus a server secret, so
 * changing the password signs everyone out.
 */
const COOKIE = "pp_admin";

async function expectedToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return sha256(`admin:${pw}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`);
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 10);
}

export async function isAdmin() {
  const expected = await expectedToken();
  if (!expected || !adminConfigured()) return false;
  return (await cookies()).get(COOKIE)?.value === expected;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Please sign in to the admin area again.");
}

/** Constant-time-ish comparison of the typed password; sets the cookie on success. */
export async function signInAdmin(password: string) {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  const [a, b] = await Promise.all([sha256(password), sha256(pw)]);
  // Slow down guessing
  await new Promise((r) => setTimeout(r, 700));
  if (!adminConfigured() || a !== b) return false;
  (await cookies()).set(COOKIE, (await expectedToken())!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 14,
  });
  return true;
}

export async function signOutAdmin() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

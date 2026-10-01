import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key.
 * Bypasses Row Level Security, so it must only ever run on the server.
 * Every route that uses it is responsible for checking party rules.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const DESIGNS_BUCKET = "designs";

/**
 * Turn a Supabase error into a readable Error and log the details, so the
 * Vercel logs say what actually went wrong (e.g. a bad key or a missing grant).
 */
export function dbError(context: string, err: { message?: string; code?: string; hint?: string | null; details?: string | null }) {
  const parts = [`[supabase] ${context} failed: ${err.message ?? "unknown error"}`];
  if (err.code) parts.push(`code=${err.code}`);
  if (err.hint) parts.push(`hint=${err.hint}`);
  if (err.details) parts.push(`details=${err.details}`);
  const message = parts.join(" | ");
  console.error(message);
  return new Error(message);
}

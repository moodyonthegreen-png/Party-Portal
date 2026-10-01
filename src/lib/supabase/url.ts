/**
 * Accept the project URL however it was pasted. Supabase's dashboard also
 * shows the REST endpoint (".../rest/v1/"); the client adds that path itself,
 * so a pasted endpoint would double it and every query fails with PGRST125.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

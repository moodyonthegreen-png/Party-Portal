import "server-only";
import { headers } from "next/headers";

function withProtocol(value: string) {
  const v = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * The site's own address (https://...), for links in emails and share buttons.
 *
 * Order: SITE_URL if set, then (on Vercel production) the project's main
 * production domain, then the address the request came in on. The middle
 * step matters: Vercel also serves every build at its own frozen URL
 * (party-portal-abc123-....vercel.app), and links built from one of those
 * would point at an old copy of the site forever.
 */
export async function siteOrigin() {
  if (process.env.SITE_URL?.trim()) return withProtocol(process.env.SITE_URL);
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return withProtocol(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

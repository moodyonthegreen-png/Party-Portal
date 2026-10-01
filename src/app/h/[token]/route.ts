import { NextResponse, type NextRequest } from "next/server";
import { findPartyByHostToken, hostCookieName, hostCookiePath } from "@/lib/host";

/**
 * Secret host link: /h/<token>. Signs this browser in as the party's host
 * and sends them to their dashboard. The token stays out of the address bar
 * after this, and out of browser history beyond this one entry.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const party = await findPartyByHostToken(token);

  if (!party) {
    return NextResponse.redirect(new URL("/host/link-expired", request.url));
  }

  const response = NextResponse.redirect(new URL(`/host/${party.slug}`, request.url));
  response.cookies.set(hostCookieName(party.slug), token.toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: hostCookiePath(party.slug),
    maxAge: 60 * 60 * 24 * 90,
  });
  // Don't let the secret link be cached anywhere
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

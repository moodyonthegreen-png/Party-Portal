import { NextResponse, type NextRequest } from "next/server";

/**
 * Serves product preview images from our own address, so hosts and guests
 * never see where they come from. Only the print partner's image hosts are
 * allowed through.
 */
export const runtime = "nodejs";

const ALLOWED = /(^|\.)printify\.com$/i;

export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("i") ?? "";
  let src: URL;
  try {
    src = new URL(Buffer.from(id, "base64url").toString("utf8"));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (src.protocol !== "https:" || !ALLOWED.test(src.hostname)) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(src, { cache: "force-cache" }).catch(() => null);
  if (!res?.ok || !res.body) return new NextResponse("Not found", { status: 404 });
  const type = res.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(res.body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
  });
}

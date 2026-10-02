import { NextResponse, type NextRequest } from "next/server";
import { getParty } from "@/lib/parties";
import { sendReveal } from "@/lib/reveal";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Daily: send keepsakes for parties that closed and asked for automatic
 * sending. Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin()
    .from("parties")
    .select("slug, host_name, host_email, reveal_email")
    .eq("reveal_auto", true)
    .is("reveal_sent_at", null)
    .not("reveal_email", "is", null)
    .lt("deadline", new Date().toISOString())
    .limit(50);
  if (error) {
    console.error("[cron] keepsake lookup failed", error);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  let sent = 0;
  const failed: string[] = [];
  for (const row of data ?? []) {
    try {
      const party = await getParty(row.slug);
      if (!party) continue;
      await sendReveal(party, {
        to: row.reveal_email,
        fromName: row.host_name || "Your host",
        replyTo: row.host_email || undefined,
      });
      sent++;
    } catch (e) {
      console.error(`[cron] keepsake for ${row.slug} failed`, e);
      failed.push(row.slug);
    }
  }
  return NextResponse.json({ sent, failed });
}

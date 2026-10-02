import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { themeFontVars } from "@/lib/fonts";
import { findPartyByRevealToken, getRevealData, markRevealOpened } from "@/lib/reveal";
import { getTheme } from "@/themes";
import { RevealView } from "./RevealView";
import "@/app/party.css";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your keepsake", robots: { index: false, follow: false } };

export default async function RevealPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { preview } = await searchParams;
  const party = await findPartyByRevealToken(token);
  if (!party) notFound();
  // Hosts previewing don't count as the guest of honor opening it
  if (!preview) await markRevealOpened(party.id);

  const data = await getRevealData(party);
  const theme = getTheme(party.theme);

  return (
    <div data-theme={theme.id} className={`pp-page ${themeFontVars}`}>
      <RevealView
        data={data}
        guestOfHonorName={party.guestOfHonorName}
        occasion={party.occasion}
        motif={theme.motif}
        partyHref={`/p/${party.slug}`}
        preview={Boolean(preview)}
      />
    </div>
  );
}

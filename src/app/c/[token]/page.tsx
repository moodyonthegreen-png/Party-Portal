import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { themeFontVars } from "@/lib/fonts";
import { getThankCard, markCardOpened } from "@/lib/thank-cards";
import { getTheme } from "@/themes";
import { getWrapUp } from "@/lib/wrapup";
import { ThankCardView } from "./ThankCardView";
import "@/app/party.css";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getThankCard((await params).token);
  return {
    title: card ? `A thank-you card for ${card.recipientName}` : "Card not found",
    robots: { index: false, follow: false },
  };
}

export default async function CardPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { preview } = await searchParams;
  const card = await getThankCard(token);
  if (!card) notFound();
  // Hosts previewing their own card don't count as the guest opening it
  if (!preview) await markCardOpened(token);

  const theme = getTheme(card.party.theme);
  // The wrap-up is a nice extra: never let it stop the card from opening
  const wrapUp = await getWrapUp(card.party, card.personKey).catch((e) => {
    console.error("[thank-card] wrap-up failed", e);
    return null;
  });
  const from = card.hostName ?? card.party.guestOfHonorName;

  return (
    <div data-theme={theme.id} className={`pp-page ${themeFontVars}`}>
      <ThankCardView
        recipientName={card.recipientName}
        message={card.message}
        designUrl={card.designUrl}
        from={from}
        guestOfHonorName={card.party.guestOfHonorName}
        motif={theme.motif}
        preview={Boolean(preview)}
        wrapUp={wrapUp}
      />
    </div>
  );
}

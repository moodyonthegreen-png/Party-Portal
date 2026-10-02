import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { themeFontVars } from "@/lib/fonts";
import { getThankCard, markCardOpened } from "@/lib/thank-cards";
import { getTheme } from "@/themes";
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
      />
    </div>
  );
}

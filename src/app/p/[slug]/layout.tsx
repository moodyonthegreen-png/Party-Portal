import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { themeFontVars } from "@/lib/fonts";
import { getParty, hasPartyAccess } from "@/lib/parties";
import { getTheme } from "@/themes";
import { PasswordGate } from "./PasswordGate";
import "@/app/party.css";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { slug } = await params;
  const party = await getParty(slug);
  return {
    title: party ? `Celebrating ${party.guestOfHonorName}` : "Party not found",
  };
}

export default async function PartyLayout({ children, params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();
  const theme = getTheme(party.theme);

  return (
    <div
      data-theme={theme.id}
      className={`pp-page ${themeFontVars}`}
    >
      {(await hasPartyAccess(party)) ? (
        children
      ) : (
        <PasswordGate slug={party.slug} guestOfHonorName={party.guestOfHonorName} />
      )}
    </div>
  );
}

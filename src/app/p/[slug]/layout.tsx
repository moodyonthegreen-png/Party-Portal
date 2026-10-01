import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getParty, hasPartyAccess } from "@/lib/parties";
import { PasswordGate } from "./PasswordGate";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { slug } = await params;
  const party = await getParty(slug);
  return { title: party ? `${party.guestOfHonorName}'s ${party.occasion.toLowerCase()}` : "Party not found" };
}

export default async function PartyLayout({ children, params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();

  if (!(await hasPartyAccess(party))) {
    return <PasswordGate slug={party.slug} guestOfHonorName={party.guestOfHonorName} />;
  }

  return <div data-theme={party.theme}>{children}</div>;
}

import type { Metadata } from "next";
import { Allura, Cormorant_Garamond, EB_Garamond } from "next/font/google";
import { notFound } from "next/navigation";
import { getParty, hasPartyAccess } from "@/lib/parties";
import { getTheme } from "@/themes";
import { PasswordGate } from "./PasswordGate";
import "./party.css";

// Theme fonts. Every theme's CSS picks from these variables.
const allura = Allura({ subsets: ["latin"], weight: "400", variable: "--font-allura", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-ebgaramond", display: "swap" });

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
      className={`pp-page ${allura.variable} ${cormorant.variable} ${ebGaramond.variable}`}
    >
      {(await hasPartyAccess(party)) ? (
        children
      ) : (
        <PasswordGate slug={party.slug} guestOfHonorName={party.guestOfHonorName} />
      )}
    </div>
  );
}

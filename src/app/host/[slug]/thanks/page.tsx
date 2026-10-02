import { notFound } from "next/navigation";
import { emailConfigured } from "@/lib/email";
import { getHostParty, viewerName } from "@/lib/host";
import { listThankYous } from "@/lib/thanks";
import { ThankYouHelper } from "./ThankYouHelper";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function ThanksPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const people = await listThankYous(party.id);

  return (
    <main style={{ paddingTop: "1.5rem", paddingBottom: "3rem" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <h2 className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)" }}>
          Thank-you helper
        </h2>
        <p className="pp-soft" style={{ fontSize: "1rem" }}>
          Everyone who celebrated {party.guestOfHonorName}, with what they did. Jot down gifts, use the drafted note as a
          starting point, and tick people off as you go.
        </p>
      </header>
      <ThankYouHelper
        slug={party.slug}
        guestOfHonorName={party.guestOfHonorName}
        signOff={viewerName(party)}
        people={people}
        canEmail={emailConfigured()}
      />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getParty } from "@/lib/parties";

type Props = { params: Promise<{ slug: string; section: string }> };

const SOON: Record<string, { title: string; body: string }> = {
  album: { title: "Photo album", body: "Soon you'll be able to share photos here and see everyone else's." },
  games: { title: "Games", body: "Soon there'll be games to play here, with a party leaderboard." },
};

export default async function ComingSoon({ params }: Props) {
  const { slug, section } = await params;
  const info = SOON[section];
  const party = await getParty(slug);
  if (!info || !party) notFound();

  return (
    <main className="pp-wrap">
      <Link href={`/p/${party.slug}`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
        ← Back to the party
      </Link>
      <div className="pp-paper" style={{ marginTop: "2rem", padding: "2.5rem 1.5rem", textAlign: "center", transform: "rotate(-1deg)" }}>
        <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(2deg)" }} />
        <h1 className="pp-script" style={{ fontSize: "3.4rem", color: "var(--pp-accent)" }}>
          {info.title}
        </h1>
        <p className="pp-caps pp-soft" style={{ marginTop: "0.8rem", fontSize: "0.8rem" }}>
          Opening soon
        </p>
        <p style={{ marginTop: "1rem", lineHeight: 1.55 }}>{info.body}</p>
      </div>
    </main>
  );
}

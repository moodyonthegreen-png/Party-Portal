import Link from "next/link";
import { notFound } from "next/navigation";
import { RULE_LABELS, raffleEntrants } from "@/lib/games/raffle";
import type { RaffleRules } from "@/lib/games/settings";
import { getParty } from "@/lib/parties";
import { listThankYous } from "@/lib/thanks";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function RafflePage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  const raffle = party?.games.raffle;
  if (!party || !raffle || !party.sections.games || !raffle.on || !raffle.prizes.length) notFound();

  const entrants = raffleEntrants(await listThankYous(party.id), raffle.rules);
  const base = `/p/${party.slug}`;
  const ways: { key: keyof RaffleRules; href: string; show: boolean }[] = [
    { key: "design", href: `${base}/design`, show: party.sections.design },
    { key: "note", href: `${base}/messages`, show: party.sections.messages },
    { key: "photos", href: `${base}/album`, show: party.sections.album },
    { key: "games", href: `${base}/games`, show: party.sections.games },
  ];
  const active = ways.filter((w) => raffle.rules[w.key] && w.show);
  const anyDrawn = raffle.winners.some(Boolean);

  return (
    <main className="pp-wrap">
      <Link href={`${base}/games`} className="pp-back">
        ← Back to games
      </Link>
      <header className="pp-head">
        <h1 className="pp-page-title">Raffle</h1>
        <p className="pp-page-kicker">{anyDrawn ? "And the winner is…" : "A little thank-you for joining in"}</p>
      </header>

      <section style={{ display: "grid", gap: "1.25rem", marginTop: "1.75rem" }}>
        {raffle.prizes.map((prize, i) => {
          const w = raffle.winners[i];
          return (
            <div
              key={i}
              className="pp-paper pp-object"
              style={{ padding: "1.4rem 1.2rem", textAlign: "center" }}
            >
              <p className="pp-caps pp-soft" style={{ fontSize: "0.7rem" }}>
                {raffle.prizes.length > 1 ? `Prize ${i + 1}` : "The prize"}
              </p>
              <p className="pp-display" style={{ fontSize: "1.45rem", fontWeight: 600, marginTop: "0.4rem" }}>
                {prize}
              </p>
              {w ? (
                <>
                  <p className="pp-caps" style={{ fontSize: "0.7rem", marginTop: "1rem" }}>
                    Winner
                  </p>
                  <p className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)", lineHeight: 1.1 }}>
                    {w.name}
                  </p>
                </>
              ) : (
                <p className="pp-soft" style={{ marginTop: "0.8rem", fontSize: "0.95rem" }}>
                  Winner drawn after the party
                </p>
              )}
            </div>
          );
        })}
      </section>

      {!raffle.winners.every(Boolean) && (
        <section className="pp-paper" style={{ marginTop: "1.75rem", padding: "1.5rem 1.2rem" }}>
          <h2 className="pp-caps" style={{ fontSize: "0.78rem" }}>
            How to enter
          </h2>
          <p className="pp-soft" style={{ marginTop: "0.4rem" }}>
            No sign-up needed. You&apos;re entered automatically, and each one you do is another entry:
          </p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: "0.8rem", display: "grid", gap: "0.5rem" }}>
            {active.map((w) => (
              <li key={w.key}>
                <Link href={w.href} className="pp-link" style={{ fontSize: "1.05rem" }}>
                  {RULE_LABELS[w.key].how}
                </Link>
              </li>
            ))}
          </ul>
          <p className="pp-caps" style={{ fontSize: "0.68rem", marginTop: "1rem" }}>
            {entrants.length} {entrants.length === 1 ? "guest" : "guests"} entered so far
          </p>
        </section>
      )}
    </main>
  );
}

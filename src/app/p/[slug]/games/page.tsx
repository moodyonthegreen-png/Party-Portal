import Link from "next/link";
import { notFound } from "next/navigation";
import { getParty } from "@/lib/parties";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function GamesHub({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.games) notFound();

  const db = supabaseAdmin();
  const [{ count: photoCount }, { count: babyPlayers }, { count: poolPlayers }] = await Promise.all([
    db.from("baby_photos").select("id", { count: "exact", head: true }).eq("party_id", party.id),
    db.from("baby_photo_guesses").select("party_id", { count: "exact", head: true }).eq("party_id", party.id),
    db.from("pool_entries").select("party_id", { count: "exact", head: true }).eq("party_id", party.id),
  ]);

  const { babyPhotos, pool, raffle } = party.games;
  const showRaffle = raffle.on && raffle.prizes.length > 0;
  const raffleWinners = raffle.winners.filter(Boolean).length;
  const showBaby = babyPhotos.on && (photoCount ?? 0) > 0;
  const base = `/p/${party.slug}/games`;

  const card: React.CSSProperties = {
    display: "flex",
    gap: "1.1rem",
    alignItems: "center",
    padding: "1.4rem 1.2rem",
    textDecoration: "none",
    color: "inherit",
  };

  return (
    <main className="pp-wrap">
      <Link href={`/p/${party.slug}`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
        ← Back to the party
      </Link>
      <header style={{ textAlign: "center", marginTop: "1.75rem" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
          Play along from anywhere
        </p>
        <h1 className="pp-script" style={{ fontSize: "3.4rem", color: "var(--pp-accent)", marginTop: "0.4rem" }}>
          Games
        </h1>
      </header>

      <div style={{ display: "grid", gap: "1.5rem", marginTop: "1.75rem" }}>
        {showBaby && (
          <Link href={`${base}/baby-photos`} className="pp-paper pp-object" style={{ ...card, transform: "rotate(-0.8deg)" }}>
            <div className="pp-mini-polaroid">
              <div>?</div>
            </div>
            <div>
              <p className="pp-script" style={{ fontSize: "2.1rem", color: "var(--pp-accent)" }}>
                Guess the baby photo
              </p>
              <p className="pp-soft" style={{ fontSize: "1rem", marginTop: 4 }}>
                {babyPhotos.revealed
                  ? "The answers are in! See how you did."
                  : `Can you tell who's who? ${photoCount} ${photoCount === 1 ? "photo" : "photos"}`}
              </p>
              <p className="pp-caps" style={{ fontSize: "0.68rem", marginTop: 6 }}>
                {babyPlayers ?? 0} {babyPlayers === 1 ? "player" : "players"} so far
              </p>
            </div>
          </Link>
        )}

        {pool.on && (
          <Link href={`${base}/due-date`} className="pp-paper pp-object" style={{ ...card, transform: "rotate(0.7deg)" }}>
            <div className="pp-calendar" aria-hidden="true">
              <div className="pp-calendar-top">Due</div>
              <div className="pp-calendar-day">?</div>
            </div>
            <div>
              <p className="pp-script" style={{ fontSize: "2.1rem", color: "var(--pp-accent)" }}>
                Due date &amp; weight pool
              </p>
              <p className="pp-soft" style={{ fontSize: "1rem", marginTop: 4 }}>
                {pool.actual
                  ? "Baby is here! See who guessed closest."
                  : pool.closed
                    ? "Guessing is closed. Results once baby arrives!"
                    : "Guess the birthday and weight. Closest wins!"}
              </p>
              <p className="pp-caps" style={{ fontSize: "0.68rem", marginTop: 6 }}>
                {poolPlayers ?? 0} {poolPlayers === 1 ? "guess" : "guesses"} so far
              </p>
            </div>
          </Link>
        )}

        {showRaffle && (
          <Link href={`${base}/raffle`} className="pp-paper pp-object" style={{ ...card, transform: "rotate(-0.5deg)" }}>
            <div className="pp-ticket" aria-hidden="true">
              <span>Admit one</span>
            </div>
            <div>
              <p className="pp-script" style={{ fontSize: "2.1rem", color: "var(--pp-accent)" }}>
                Raffle
              </p>
              <p className="pp-soft" style={{ fontSize: "1rem", marginTop: 4 }}>
                {raffleWinners
                  ? "The winners have been drawn! See who won."
                  : `Up for grabs: ${raffle.prizes.join(", ")}. You're entered just for joining in!`}
              </p>
              <p className="pp-caps" style={{ fontSize: "0.68rem", marginTop: 6 }}>
                {raffle.prizes.length} {raffle.prizes.length === 1 ? "prize" : "prizes"}
              </p>
            </div>
          </Link>
        )}

        {!showBaby && !pool.on && !showRaffle && (
          <p className="pp-soft" style={{ textAlign: "center" }}>
            The host is still setting up the games. Check back soon!
          </p>
        )}
      </div>
    </main>
  );
}

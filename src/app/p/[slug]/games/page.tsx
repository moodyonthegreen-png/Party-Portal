import Link from "next/link";
import { Icon } from "@/components/Icon";
import { notFound } from "next/navigation";
import { getParty } from "@/lib/parties";
import { scratchTitle } from "@/lib/games/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function GamesHub({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.games) notFound();

  const db = supabaseAdmin();
  const [{ count: photoCount }, { count: babyPlayers }, { count: poolPlayers }, scratchCards, triviaPlayers, animalPlayers] = await Promise.all([
    db.from("baby_photos").select("id", { count: "exact", head: true }).eq("party_id", party.id),
    db.from("baby_photo_guesses").select("party_id", { count: "exact", head: true }).eq("party_id", party.id),
    db.from("pool_entries").select("party_id", { count: "exact", head: true }).eq("party_id", party.id),
    db.from("scratch_cards").select("player_name, is_winner").eq("party_id", party.id),
    db.from("trivia_answers").select("party_id", { count: "exact", head: true }).eq("party_id", party.id),
    db.from("game_answers").select("party_id", { count: "exact", head: true }).eq("party_id", party.id).eq("game", "animals"),
  ]);

  const { babyPhotos, pool, raffle, scratch, trivia, animals } = party.games;
  const showAnimals = animals.on && animals.questions.length > 0 && !animalPlayers.error;
  const animalCount = animalPlayers.count ?? 0;
  const showTrivia = trivia.on && trivia.questions.length > 0 && !triviaPlayers.error;
  const triviaCount = triviaPlayers.count ?? 0;
  // Hidden until the host adds the photo (and the database update has been run)
  const showScratch = scratch.on && Boolean(scratch.photoPath) && !scratchCards.error;
  const scratchPlayers = scratchCards.data?.length ?? 0;
  const scratchWinner = scratchCards.data?.find((c) => c.is_winner)?.player_name as string | undefined;
  const scratchPerson = scratch.who === "mommy" ? "mommy" : "daddy";
  const showRaffle = raffle.on && raffle.prizes.length > 0;
  const raffleWinners = raffle.winners.filter(Boolean).length;
  const showBaby = babyPhotos.on && (photoCount ?? 0) > 0;
  const base = `/p/${party.slug}/games`;


  return (
    <main className="pp-wrap">
      <Link href={`/p/${party.slug}`} className="pp-back">
        ← Back to the party
      </Link>
      <header className="pp-head">
        <h1 className="pp-page-title">Games</h1>
        <p className="pp-page-kicker">Play along from anywhere</p>
      </header>

      <div className="pp-contents" style={{ marginTop: 0 }}>
        {showBaby && (
          <Link href={`${base}/baby-photos`} className="pp-paper pp-entry">
            <div>
              <h3>Guess the baby photo</h3>
              <p>
                {babyPhotos.revealed
                  ? "The answers are in. See how you did."
                  : `Can you tell who's who? ${photoCount} ${photoCount === 1 ? "photo" : "photos"}, ${babyPlayers ?? 0} ${babyPlayers === 1 ? "player" : "players"} so far.`}
                {babyPhotos.prize.on && babyPhotos.prize.prize && !babyPhotos.revealed ? ` The winner gets ${babyPhotos.prize.prize}.` : ""}
              </p>
            </div>
            <div className="pp-entry-art">
              <span className="pp-entry-icon">
                <Icon name="camera" size={28} />
              </span>
            </div>
          </Link>
        )}

        {showTrivia && (
          <Link href={`${base}/trivia`} className="pp-paper pp-entry">
            <div>
              <h3>Baby trivia</h3>
              <p>
                {trivia.closed
                  ? "Trivia is closed. See the leaderboard."
                  : `${trivia.questions.length} multiple-choice questions about babies. ${triviaCount} ${triviaCount === 1 ? "player" : "players"} so far.`}
                {trivia.prize.on && trivia.prize.prize && !trivia.closed ? ` The top score wins ${trivia.prize.prize}.` : ""}
              </p>
            </div>
            <div className="pp-entry-art">
              <span className="tv-mini" aria-hidden="true">
                <span>A</span>
                <span>B</span>
                <span>C</span>
              </span>
            </div>
          </Link>
        )}

        {showAnimals && (
          <Link href={`${base}/animals`} className="pp-paper pp-entry">
            <div>
              <h3>Baby animal names</h3>
              <p>
                {animals.closed
                  ? "This game is closed. See the leaderboard."
                  : `A baby kangaroo is a joey. Can you name the rest? ${animalCount} ${animalCount === 1 ? "player" : "players"} so far.`}
                {animals.prize.on && animals.prize.prize && !animals.closed ? ` The top score wins ${animals.prize.prize}.` : ""}
              </p>
            </div>
            <div className="pp-entry-art">
              <span className="pp-entry-icon">
                <Icon name="pencil" size={28} />
              </span>
            </div>
          </Link>
        )}

        {showScratch && (
          <Link href={`${base}/scratch`} className="pp-paper pp-entry">
            <div>
              <h3>{scratchTitle(scratch.who)}</h3>
              <p>
                {scratchWinner
                  ? `${scratchWinner} found the ${scratchPerson}!`
                  : `Scratch off your card. One lucky card shows the ${scratchPerson}. ${scratchPlayers} ${scratchPlayers === 1 ? "card" : "cards"} scratched so far.`}
                {scratch.prize.on && scratch.prize.prize && !scratchWinner ? ` The winner gets ${scratch.prize.prize}.` : ""}
              </p>
            </div>
            <div className="pp-entry-art">
              <span className="sc-mini" aria-hidden="true">
                <span>?</span>
              </span>
            </div>
          </Link>
        )}

        {pool.on && (
          <Link href={`${base}/due-date`} className="pp-paper pp-entry">
            <div>
              <h3>Due date &amp; weight pool</h3>
              <p>
                {pool.actual
                  ? "Baby is here! See who guessed closest."
                  : pool.closed
                    ? "Guessing is closed. Results once baby arrives."
                    : `Guess the birthday and weight. Closest wins. ${poolPlayers ?? 0} ${poolPlayers === 1 ? "guess" : "guesses"} so far.`}
                {pool.prize.on && pool.prize.prize && !pool.actual ? ` The winner gets ${pool.prize.prize}.` : ""}
              </p>
            </div>
            <div className="pp-entry-art">
              <span className="pp-calendar" aria-hidden="true">
                <span className="pp-calendar-top">Due</span>
                <span className="pp-calendar-day">?</span>
              </span>
            </div>
          </Link>
        )}

        {showRaffle && (
          <Link href={`${base}/raffle`} className="pp-paper pp-entry">
            <div>
              <h3>Raffle</h3>
              <p>
                {raffleWinners
                  ? "The winners have been drawn. See who won."
                  : `Up for grabs: ${raffle.prizes.join(", ")}. You're entered just for joining in.`}
              </p>
            </div>
            <div className="pp-entry-art">
              <span className="pp-entry-icon">
                <Icon name="ticket" size={28} />
              </span>
            </div>
          </Link>
        )}

        {!showBaby && !pool.on && !showRaffle && !showScratch && !showTrivia && !showAnimals && (
          <p className="pp-soft">The host is still setting up the games. Check back soon.</p>
        )}
      </div>
    </main>
  );
}

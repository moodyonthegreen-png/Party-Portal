import { notFound } from "next/navigation";
import { emailConfigured } from "@/lib/email";
import { listBabyGuesses, listBabyPhotos, listPoolEntries } from "@/lib/games";
import { raffleEntrants } from "@/lib/games/raffle";
import { gameWinners } from "@/lib/games/winners";
import { scoreBabyPhotos } from "@/lib/games/scoring";
import { getHostParty } from "@/lib/host";
import { listThankYous } from "@/lib/thanks";
import { HostGames } from "./HostGames";
import { RaffleHost } from "./RaffleHost";
import { ScratchHost } from "./ScratchHost";
import { getWinningCard, listScratchCards, scratchPhotoUrl } from "@/lib/games/scratch";

type Props = { params: Promise<{ slug: string }> };

export default async function HostGamesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const [photos, guesses, poolEntries, people, scratchCards, winningCard, scratchPhoto] = await Promise.all([
    listBabyPhotos(party.id),
    listBabyGuesses(party.id, null),
    listPoolEntries(party.id, null),
    listThankYous(party.id),
    listScratchCards(party.id),
    getWinningCard(party.id).catch(() => null),
    scratchPhotoUrl(party.games.scratch.photoPath),
  ]);
  const emails = new Map(people.map((p) => [p.key, p.email]));
  const results = await gameWinners(party);
  const winnersFor = (g: "babyPhotos" | "pool" | "scratch") =>
    (results.find((r) => r.game === g)?.winners ?? []).map((w) => ({ ...w, email: emails.get(w.key) ?? null }));
  const entrants = raffleEntrants(people, party.games.raffle.rules).map((e) => ({ ...e, email: emails.get(e.key) ?? null }));
  const babyBoard = scoreBabyPhotos(
    photos.map((p) => ({ id: p.id, answer: p.answer })),
    guesses.map((g) => ({ name: g.name, guesses: g.guesses })),
  );

  const g = party.games;
  const added = [g.babyPhotos.on, g.pool.on, g.scratch.on, g.raffle.on].filter(Boolean).length;

  return (
    <main style={{ paddingTop: "1.5rem", display: "grid", gap: "1rem" }}>
      <header className="gl-intro">
        <h2 className="pp-script">Game library</h2>
        <p className="pp-soft">
          Add the games you&apos;d like at your party. Guests only see the games you&apos;ve added, and each one&apos;s setup opens
          once it&apos;s added. {added} of 4 added.
        </p>
      </header>
      {!party.sections.games && (
        <p className="pp-note">Games are turned off for guests. You can turn them on in Party details.</p>
      )}
      <HostGames
        slug={party.slug}
        games={party.games}
        photos={photos}
        babyBoard={babyBoard.map((r) => ({ name: r.name, correct: r.correct, total: r.total, place: r.place }))}
        poolCount={poolEntries.length}
        winners={{ babyPhotos: winnersFor("babyPhotos"), pool: winnersFor("pool") }}
        canEmail={emailConfigured()}
      />
      <ScratchHost
        slug={party.slug}
        game={party.games.scratch}
        ready={scratchCards !== null}
        photoUrl={scratchPhoto}
        cards={(scratchCards ?? []).map((c) => ({ cardNo: c.cardNo, name: c.name, winner: c.winner }))}
        winningCard={winningCard}
        winners={winnersFor("scratch")}
        canEmail={emailConfigured()}
        guestListSize={people.filter((p) => p.onGuestList).length}
      />
      <RaffleHost slug={party.slug} raffle={party.games.raffle} entrants={entrants} canEmail={emailConfigured()} />
    </main>
  );
}

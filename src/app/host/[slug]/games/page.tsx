import { notFound } from "next/navigation";
import { listBabyGuesses, listBabyPhotos, listPoolEntries } from "@/lib/games";
import { scoreBabyPhotos } from "@/lib/games/scoring";
import { getHostParty } from "@/lib/host";
import { HostGames } from "./HostGames";

type Props = { params: Promise<{ slug: string }> };

export default async function HostGamesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const [photos, guesses, poolEntries] = await Promise.all([
    listBabyPhotos(party.id),
    listBabyGuesses(party.id, null),
    listPoolEntries(party.id, null),
  ]);
  const babyBoard = scoreBabyPhotos(
    photos.map((p) => ({ id: p.id, answer: p.answer })),
    guesses.map((g) => ({ name: g.name, guesses: g.guesses })),
  );

  return (
    <main style={{ paddingTop: "1.5rem", display: "grid", gap: "1.75rem" }}>
      {!party.sections.games && (
        <p className="pp-note">Games are turned off for guests. You can turn them on in Party details.</p>
      )}
      <HostGames
        slug={party.slug}
        games={party.games}
        photos={photos}
        babyBoard={babyBoard.map((r) => ({ name: r.name, correct: r.correct, total: r.total, place: r.place }))}
        poolCount={poolEntries.length}
      />
    </main>
  );
}

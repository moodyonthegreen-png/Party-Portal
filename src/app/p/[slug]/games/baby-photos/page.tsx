import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { listBabyGuesses, listBabyPhotos } from "@/lib/games";
import { scoreBabyPhotos } from "@/lib/games/scoring";
import { getParty } from "@/lib/parties";
import { BabyPhotoGame } from "./BabyPhotoGame";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function BabyPhotosPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.games || !party.games.babyPhotos.on) notFound();

  const deviceHash = await currentDeviceHash(party);
  const [photos, entries] = await Promise.all([listBabyPhotos(party.id), listBabyGuesses(party.id, deviceHash)]);
  if (!photos.length) notFound();

  const revealed = party.games.babyPhotos.revealed;
  const mine = entries.find((e) => e.mine) ?? null;
  // Everyone picks from the same list of names; which name goes with which
  // photo only reaches the browser once the host reveals the answers.
  const options = [...new Set(photos.map((p) => p.answer))].sort((a, b) => a.localeCompare(b));

  const board = revealed
    ? scoreBabyPhotos(
        photos.map((p) => ({ id: p.id, answer: p.answer })),
        entries.map((e) => ({ name: e.name, guesses: e.guesses })),
      ).map((r, i) => ({ ...r, mine: entries.find((e) => e.name === r.name)?.mine ?? false, key: i }))
    : [];

  return (
    <main className="pp-wrap" style={{ maxWidth: "54rem" }}>
      <Link href={`/p/${party.slug}/games`} className="pp-back">
        ← Back to games
      </Link>
      <header className="pp-head">
        <h1 className="pp-page-title">Guess the baby photo</h1>
        <p className="pp-page-kicker">{revealed ? "The answers are in" : "Who's who?"}</p>
        {!revealed && (
          <p className="pp-soft" style={{ marginTop: "0.5rem" }}>
            Match each baby photo to the grown-up it belongs to. You can change your guesses until the host reveals the answers.
          </p>
        )}
      </header>

      <BabyPhotoGame
        slug={party.slug}
        revealed={revealed}
        photos={photos.map((p) => ({ id: p.id, url: p.url, answer: revealed ? p.answer : null }))}
        options={options}
        myName={mine?.name ?? ""}
        myGuesses={mine?.guesses ?? {}}
        players={entries.length}
        board={board}
      />
    </main>
  );
}

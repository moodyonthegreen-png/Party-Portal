import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { getScratch } from "@/lib/games/scratch";
import { scratchTitle } from "@/lib/games/settings";
import { getParty } from "@/lib/parties";
import { PrizeNote } from "../PrizeNote";
import { ScratchGame } from "./ScratchGame";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function ScratchPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  const game = party?.games.scratch;
  if (!party || !game || !party.sections.games || !game.on || !game.photoPath) notFound();

  const state = await getScratch(party, await currentDeviceHash(party));
  if (!state.ready || !state.photoUrl) notFound();

  const title = scratchTitle(game.who);
  const person = game.who === "mommy" ? "mommy" : "daddy";
  const winner = state.winner;

  return (
    <main className="pp-wrap" style={{ maxWidth: "40rem" }}>
      <Link href={`/p/${party.slug}/games`} className="pp-back">
        ← Back to games
      </Link>
      <header className="pp-head">
        <h1 className="pp-page-title">{title}</h1>
        <p className="pp-page-kicker">A scratch-off game</p>
        <p className="pp-soft" style={{ marginTop: "0.5rem" }}>
          Everyone gets one scratch-off card. Only one lucky card shows the {person}-to-be. Will it be yours?
        </p>
      </header>

      <PrizeNote prize={game.prize} winners={winner ? [winner.name] : null} />

      {winner && !state.mine?.winner && !(game.prize.on && game.prize.prize) && (
        <p className="pp-note sc-found">
          <strong>{winner.name}</strong> has the {person}! They found it on card No. {winner.cardNo}.
        </p>
      )}

      <ScratchGame
        slug={party.slug}
        who={game.who}
        title={title}
        photoUrl={state.photoUrl}
        mine={state.mine ? { cardNo: state.mine.cardNo, winner: state.mine.winner } : null}
        found={Boolean(winner)}
        prize={game.prize.on && game.prize.prize ? game.prize.prize : null}
      />

      <p className="pp-soft" style={{ textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>
        {state.players} {state.players === 1 ? "card" : "cards"} scratched so far
      </p>
    </main>
  );
}

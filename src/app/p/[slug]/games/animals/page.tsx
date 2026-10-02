import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { listGameAnswers } from "@/lib/games";
import { scoreTyped } from "@/lib/games/answer-match";
import { animalPrompt, animalQuestions } from "@/lib/games/animal-babies";
import { getParty } from "@/lib/parties";
import { PrizeNote } from "../PrizeNote";
import { AnimalGame } from "./AnimalGame";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export default async function AnimalsPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  const game = party?.games.animals;
  if (!party || !game || !party.sections.games || !game.on) notFound();

  const questions = animalQuestions(game.questions);
  const entries = await listGameAnswers(party.id, "animals", await currentDeviceHash(party));
  if (!questions.length || !entries) notFound();

  const board = scoreTyped(questions, game.accepted, entries);
  const mine = board.find((r) => r.mine) ?? null;
  const winners = game.closed ? [...new Set(board.filter((r) => r.place === 1 && r.correct > 0).map((r) => r.name))] : null;

  return (
    <main className="pp-wrap" style={{ maxWidth: "44rem" }}>
      <Link href={`/p/${party.slug}/games`} className="pp-back">
        ← Back to games
      </Link>
      <header className="pp-head">
        <h1 className="pp-page-title">Baby animal names</h1>
        <p className="pp-page-kicker">{questions.length} animals · type your answers</p>
        {!mine && !game.closed && (
          <p className="pp-soft" style={{ marginTop: "0.5rem" }}>
            A baby kangaroo is a joey. Do you know the rest? Type what each animal's baby is called. Spelling doesn't have to be perfect.
          </p>
        )}
      </header>
      <PrizeNote prize={game.prize} winners={winners} />

      {mine ? (
        <>
          <section className="pp-paper tv-score">
            <p className="pp-caps pp-soft" style={{ fontSize: "0.72rem" }}>
              Your score
            </p>
            <p className="pp-script tv-score-big">
              {mine.correct} of {mine.total}
            </p>
            <p>
              {mine.correct === mine.total
                ? "A perfect score. You really know your animals!"
                : board.length > 1
                  ? `You're in ${ordinal(mine.place)} place${board.filter((r) => r.place === mine.place).length > 1 ? " (tied)" : ""} out of ${board.length} players.`
                  : "You're the first to play!"}
            </p>
          </section>

          <h2 className="pp-caps" style={{ fontSize: "0.75rem", marginTop: "2rem" }}>
            The answers
          </h2>
          <ol className="tv-review">
            {questions.map((q, i) => {
              const typed = mine.answers[q.id];
              const right = mine.right.includes(q.id);
              return (
                <li key={q.id} className="pp-paper" data-right={right}>
                  <p className="tv-review-q">
                    <span className="tv-mark" aria-label={right ? "Correct" : "Not quite"}>
                      {right ? "✓" : "✗"}
                    </span>
                    {i + 1}. {animalPrompt(q)}
                  </p>
                  <p className="tv-review-a">
                    <strong>{capital(q.accepted[0])}</strong>
                    {q.accepted.length > 1 && <span className="pp-soft"> (or {q.accepted.slice(1).join(", ")})</span>}
                    {typed ? <span className="pp-soft"> · you said &ldquo;{typed}&rdquo;</span> : <span className="pp-soft"> · skipped</span>}
                  </p>
                  {q.fact && <p className="pp-soft tv-fact">{q.fact}</p>}
                </li>
              );
            })}
          </ol>
        </>
      ) : game.closed ? (
        <p className="pp-note" style={{ marginTop: "1.25rem" }}>
          This game is closed. Thanks to everyone who played!
        </p>
      ) : (
        <AnimalGame slug={party.slug} questions={questions.map((q) => ({ id: q.id, animal: q.animal }))} />
      )}

      {(mine || game.closed) && board.length > 0 && (
        <>
          <h2 className="pp-caps" style={{ fontSize: "0.75rem", marginTop: "2rem" }}>
            Leaderboard
          </h2>
          <table className="pp-board-table" style={{ marginTop: "0.5rem" }}>
            <tbody>
              {board.slice(0, 15).map((r, i) => (
                <tr key={i} style={r.mine ? { fontWeight: 600 } : undefined}>
                  <td style={{ width: "2.5rem" }}>
                    <span className="pp-place" data-top={r.place === 1}>
                      {r.place}
                    </span>
                  </td>
                  <td>
                    {r.name}
                    {r.mine ? " (you)" : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {r.correct} / {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

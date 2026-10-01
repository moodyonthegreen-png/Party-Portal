import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { listPoolEntries } from "@/lib/games";
import { formatWeight, scorePool } from "@/lib/games/scoring";
import { getParty } from "@/lib/parties";
import { PoolForm } from "./PoolForm";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

function niceDate(d: string, time?: string | null) {
  const date = new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  if (!time) return date;
  const [h, m] = time.split(":").map(Number);
  const t = new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${t}`;
}

export default async function DueDatePoolPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.games || !party.games.pool.on) notFound();

  const pool = party.games.pool;
  const entries = await listPoolEntries(party.id, await currentDeviceHash(party));
  const mine = entries.find((e) => e.mine) ?? null;
  const results = pool.actual ? scorePool(pool.actual, entries) : null;

  return (
    <main className="pp-wrap">
      <Link href={`/p/${party.slug}/games`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
        ← Back to games
      </Link>
      <header style={{ textAlign: "center", marginTop: "1.75rem" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
          {pool.actual ? "Baby is here!" : "Closest guess wins"}
        </p>
        <h1 className="pp-script" style={{ fontSize: "3.2rem", color: "var(--pp-accent)", marginTop: "0.4rem" }}>
          Due date &amp; weight pool
        </h1>
      </header>

      {pool.actual && results ? (
        <>
          <section className="pp-paper" style={{ marginTop: "1.75rem", padding: "1.5rem 1.2rem", textAlign: "center", transform: "rotate(-0.8deg)" }}>
            <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(-2deg)" }} />
            <p className="pp-caps pp-soft" style={{ fontSize: "0.72rem" }}>
              Welcome to the world
            </p>
            <p className="pp-display" style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "0.6rem" }}>
              {niceDate(pool.actual.date, pool.actual.time)}
            </p>
            <p className="pp-display" style={{ fontSize: "1.25rem", marginTop: "0.2rem" }}>
              {formatWeight(pool.actual.weightOz)}
              {pool.actual.lengthIn != null ? ` · ${pool.actual.lengthIn} in` : ""}
            </p>
            <div style={{ display: "grid", gap: "0.3rem", marginTop: "1rem", fontSize: "1rem" }}>
              {results.closestDate.length > 0 && <p>📅 Closest birthday: <strong>{results.closestDate.join(", ")}</strong></p>}
              {results.closestWeight.length > 0 && <p>⚖️ Closest weight: <strong>{results.closestWeight.join(", ")}</strong></p>}
              {results.closestLength.length > 0 && <p>📏 Closest length: <strong>{results.closestLength.join(", ")}</strong></p>}
            </div>
          </section>

          <section className="pp-paper" style={{ marginTop: "1.75rem", padding: "1.4rem 1.2rem" }}>
            <h2 className="pp-caps" style={{ fontSize: "0.8rem", marginBottom: "0.8rem" }}>
              Leaderboard
            </h2>
            {results.overall.length === 0 ? (
              <p className="pp-soft">Nobody entered the pool.</p>
            ) : (
              <table className="pp-board-table">
                <thead>
                  <tr>
                    <th style={{ width: "3rem" }}>Place</th>
                    <th>Name</th>
                    <th>Guess</th>
                  </tr>
                </thead>
                <tbody>
                  {results.overall.map((r) => (
                    <tr key={r.i} data-mine={r.mine}>
                      <td>
                        <span className="pp-place" data-top={r.place === 1}>
                          {r.place}
                        </span>
                      </td>
                      <td>
                        {r.name}
                        {r.mine ? " (you)" : ""}
                      </td>
                      <td className="pp-soft" style={{ fontSize: "0.92rem" }}>
                        {niceDate(r.date, r.time)} · {formatWeight(r.weightOz)}
                        {r.lengthIn != null ? ` · ${r.lengthIn} in` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="pp-soft" style={{ fontSize: "0.82rem", marginTop: "0.8rem" }}>
              Overall places add up how close each guess was on birthday, weight{pool.actual.lengthIn != null ? " and length" : ""}.
            </p>
          </section>
        </>
      ) : (
        <>
          {pool.closed ? (
            <p className="pp-note" style={{ marginTop: "1.75rem", textAlign: "center" }}>
              Guessing is closed. Results will be posted here once baby arrives!
            </p>
          ) : (
            <PoolForm
              slug={party.slug}
              initial={
                mine
                  ? {
                      name: mine.name,
                      date: mine.date,
                      time: mine.time ?? "",
                      weightLb: Math.floor(mine.weightOz / 16),
                      weightOz: mine.weightOz % 16,
                      lengthIn: mine.lengthIn != null ? String(mine.lengthIn) : "",
                    }
                  : null
              }
            />
          )}

          <section className="pp-paper" style={{ marginTop: "1.75rem", padding: "1.4rem 1.2rem" }}>
            <h2 className="pp-caps" style={{ fontSize: "0.8rem", marginBottom: "0.8rem" }}>
              Everyone&apos;s guesses ({entries.length})
            </h2>
            {entries.length === 0 ? (
              <p className="pp-soft">No guesses yet. Be the first!</p>
            ) : (
              <table className="pp-board-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Birthday</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} data-mine={e.mine}>
                      <td>
                        {e.name}
                        {e.mine ? " (you)" : ""}
                      </td>
                      <td>{niceDate(e.date, e.time)}</td>
                      <td>
                        {formatWeight(e.weightOz)}
                        {e.lengthIn != null ? <span className="pp-soft"> · {e.lengthIn} in</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

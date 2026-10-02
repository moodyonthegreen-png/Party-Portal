import { Icon } from "@/components/Icon";
import type { GamePrize } from "@/lib/games/settings";

/** "The winner gets …" on a game, and who won once results are out. */
export function PrizeNote({ prize, winners }: { prize: GamePrize; winners: string[] | null }) {
  if (!prize.on || !prize.prize) return null;
  const done = winners !== null;
  return (
    <p className="pp-note pp-prize">
      <Icon name="gift" size={22} />
      <span>
        {done && winners.length ? (
          <>
            <strong>{joinNames(winners)}</strong> {winners.length === 1 ? "wins" : "each win"} {prize.prize}. Congratulations!
          </>
        ) : done ? (
          <>The results are in. No winning score this time.</>
        ) : (
          <>
            The winner gets <strong>{prize.prize}</strong>.
          </>
        )}
      </span>
    </p>
  );
}

function joinNames(n: string[]) {
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

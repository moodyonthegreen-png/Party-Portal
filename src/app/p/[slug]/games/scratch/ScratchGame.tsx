"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { drawScratch } from "../actions";

type Card = { cardNo: number; winner: boolean };

const BRUSH = 24;
const DONE_AT = 0.62;

/** The foil layer: drag a finger or the mouse across it to scratch it away. */
function Foil({ onDone, label }: { onDone: () => void; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const box = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const w = box.width;
    const h = box.height;

    // Brushed gold foil with a soft sheen
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#b8913f");
    g.addColorStop(0.35, "#e9d08d");
    g.addColorStop(0.5, "#f7e7b4");
    g.addColorStop(0.65, "#d9b866");
    g.addColorStop(1, "#a9822f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#fff";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;

    // Little sparkles and the prompt
    ctx.fillStyle = "rgb(255 255 255 / 0.55)";
    const star = (x: number, y: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        const rr = i % 2 ? r * 0.3 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    };
    [
      [0.16, 0.18, 9],
      [0.84, 0.22, 7],
      [0.22, 0.8, 6],
      [0.8, 0.78, 10],
      [0.5, 0.12, 5],
    ].forEach(([x, y, r]) => star(x * w, y * h, r));
    ctx.fillStyle = "rgb(80 58 14 / 0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(w / 15)}px system-ui, sans-serif`;
    ctx.fillText(label, w / 2, h / 2 - w / 22);
    ctx.font = `${Math.round(w / 24)}px system-ui, sans-serif`;
    ctx.fillText("Scratch with your finger", w / 2, h / 2 + w / 16);
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH * 2;
  }, [label]);

  const cleared = useCallback(() => {
    const c = canvas.current!;
    const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total++;
      if (data[i] < 128) clear++;
    }
    return total ? clear / total : 0;
  }, []);

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (finished.current) return;
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    if (last.current) {
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.arc(p.x, p.y, BRUSH, 0, Math.PI * 2);
      ctx.fill();
    }
    last.current = p;
    if (++strokes.current % 8 === 0 && cleared() > DONE_AT) {
      finished.current = true;
      onDone();
    }
  };

  return (
    <canvas
      ref={canvas}
      className="sc-foil"
      aria-label={`${label}. Drag to scratch.`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = null;
        scratch(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === "touch") scratch(e);
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}

export function ScratchGame({
  slug,
  who,
  title,
  photoUrl,
  mine,
  found,
  prize,
}: {
  slug: string;
  who: "daddy" | "mommy";
  title: string;
  photoUrl: string;
  mine: Card | null;
  /** Someone already scratched the winning card */
  found: boolean;
  prize: string | null;
}) {
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const [name, setName] = useState("");
  const [card, setCard] = useState<Card | null>(mine);
  // Cards dealt on an earlier visit are already scratched
  const [revealed, setRevealed] = useState(Boolean(mine));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [nameKey]);

  async function deal() {
    if (!name.trim()) {
      setError("Please add your name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(nameKey, name.trim());
    } catch {
      /* ignore */
    }
    const res = await drawScratch(slug, { name });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCard(res.card);
  }

  const reveal = () => {
    setRevealed(true);
    router.refresh();
  };

  if (!card) {
    if (found) return null;
    return (
      <div className="sc-deal pp-paper">
        <label htmlFor="sc-name" className="pp-caps" style={{ fontSize: "0.72rem" }}>
          Your name
        </label>
        <input id="sc-name" className="pp-field" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="So we know whose card it is" />
        {error && (
          <p role="alert" style={{ color: "var(--pp-leather)" }}>
            {error}
          </p>
        )}
        <button type="button" className="pp-btn" onClick={deal} disabled={busy}>
          {busy ? "Dealing your card…" : "Get my card"}
        </button>
        <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
          One card per person, and it&apos;s yours to keep. No peeking at other people&apos;s!
        </p>
      </div>
    );
  }

  const person = who === "mommy" ? "mommy" : "daddy";
  return (
    <div className="sc-wrap">
      <div className="sc-card" data-winner={card.winner} data-revealed={revealed}>
        <div className="sc-card-top">
          <span className="pp-caps">{title}</span>
          <span className="sc-no">No. {String(card.cardNo).padStart(3, "0")}</span>
        </div>
        <div className="sc-window">
          <img src={photoUrl} alt={card.winner ? `The ${person}` : ""} className="sc-photo" draggable={false} />
          {!card.winner && (
            <div className="sc-miss" aria-hidden={!revealed}>
              <span>Not this time!</span>
            </div>
          )}
          {!revealed && <Foil label="Scratch to see" onDone={reveal} />}
        </div>
        {!revealed && (
          <button type="button" className="pp-link sc-skip" onClick={reveal}>
            Reveal without scratching
          </button>
        )}
      </div>

      {revealed && (
        <div className="sc-result" role="status">
          {card.winner ? (
            <>
              <p className="pp-script sc-result-big">You have the {person}!</p>
              <p>
                Card No. {card.cardNo} was the one. Congratulations!
                {prize ? (
                  <>
                    {" "}
                    You win <strong>{prize}</strong>, and the host will be in touch.
                  </>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <p className="pp-script sc-result-big">So close!</p>
              <p className="pp-soft">
                {found ? `Someone else already has the ${person}.` : `Card No. ${card.cardNo} wasn't the one. Check back to see who has the ${person}!`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

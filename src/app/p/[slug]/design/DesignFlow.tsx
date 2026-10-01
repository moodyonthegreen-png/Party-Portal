"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { prepareFromCanvas, prepareFromPhoto, type PreparedDesign } from "@/lib/image/browser";
import type { Warning } from "@/lib/image/drawing";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { finishDesignUpload, startDesignUpload } from "./actions";
import { DrawPad } from "./DrawPad";

export type MyDesign = { name: string; url: string | null; updatedAt: string };

type Step =
  | { kind: "name" }
  | { kind: "capture" }
  | { kind: "draw" }
  | { kind: "processing" }
  | { kind: "review"; prepared: PreparedDesign; source: "photo" | "drawn" }
  | { kind: "uploading"; prepared: PreparedDesign; source: "photo" | "drawn" }
  | { kind: "done"; designUrl: string };

const WARNING_TEXT: Record<Warning, { title: string; body: string }> = {
  blurry: {
    title: "This photo looks a little blurry",
    body: "Hold your phone steady, tap the screen to focus, and make sure there's plenty of light.",
  },
  "no-drawing": {
    title: "We couldn't find a drawing",
    body: "Make sure the drawing card fills most of the photo and the drawing is dark enough to see.",
  },
  faint: {
    title: "Your drawing looks very light",
    body: "Light pencil can fade on fabric. Going over it in marker or crayon will print best.",
  },
  "card-not-found": {
    title: "We couldn't spot the edges of your card",
    body: "Try a photo with the card on a darker surface, so it stands out.",
  },
};

// Themed styles live in party.css
const field = "pp-field";
const primary = "pp-btn";
const secondary = "pp-btn pp-btn-ghost";

export function DesignFlow({
  slug,
  guestNames,
  requireGuestList,
  allowDrawing,
  myDesigns,
}: {
  slug: string;
  guestNames: string[];
  requireGuestList: boolean;
  allowDrawing: boolean;
  myDesigns: MyDesign[];
}) {
  const [step, setStep] = useState<Step>({ kind: "name" });
  const [name, setName] = useState("");
  const [typingName, setTypingName] = useState(guestNames.length === 0);
  const [error, setError] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step.kind]);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    go({ kind: "processing" });
    try {
      go({ kind: "review", prepared: await prepareFromPhoto(file), source: "photo" });
    } catch (err) {
      setStep({ kind: "capture" });
      setError(err instanceof Error ? err.message : "Something went wrong with that photo.");
    }
  }

  async function onDrawn(canvas: HTMLCanvasElement) {
    go({ kind: "processing" });
    go({ kind: "review", prepared: await prepareFromCanvas(canvas), source: "drawn" });
  }

  async function submit(prepared: PreparedDesign, source: "photo" | "drawn") {
    setStep({ kind: "uploading", prepared, source });
    setError(null);
    try {
      const start = await startDesignUpload(slug, name);
      if (!start.ok) throw new Error(start.error);

      const bucket = supabaseBrowser().storage.from("designs");
      const [a, b] = await Promise.all([
        bucket.uploadToSignedUrl(start.design.path, start.design.token, prepared.designBlob, { contentType: "image/png" }),
        bucket.uploadToSignedUrl(start.original.path, start.original.token, prepared.originalBlob, {
          contentType: source === "drawn" ? "image/png" : "image/jpeg",
        }),
      ]);
      if (a.error || b.error) throw new Error("Your design didn't finish uploading. Check your connection and try again.");

      const sharp = prepared.result.sharpness;
      const done = await finishDesignUpload(slug, {
        guestId: start.guestId,
        version: start.version,
        width: prepared.result.image.width,
        height: prepared.result.image.height,
        source,
        blurScore: Number.isFinite(sharp) ? sharp : null,
      });
      if (!done.ok) throw new Error(done.error);

      setStep({ kind: "done", designUrl: prepared.designUrl });
      // Refresh "Added from this device" for the next visit to the name step
      router.refresh();
    } catch (err) {
      setStep({ kind: "review", prepared, source });
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  const nameIsValid =
    name.trim().length > 0 &&
    (!requireGuestList || guestNames.some((n) => n.toLowerCase() === name.trim().toLowerCase()));

  return (
    <div ref={topRef} className="scroll-mt-6">
      {myDesigns.length > 0 && step.kind === "name" && (
        <section className="mt-6 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-medium">Added from this device</h2>
          <ul className="mt-3 space-y-3">
            {myDesigns.map((d) => (
              <li key={d.name} className="flex items-center gap-3">
                <div className="checker size-14 shrink-0 overflow-hidden rounded-lg border border-line">
                  {d.url && (
                    <img src={d.url} alt={`${d.name}'s design`} className="size-full object-contain" />
                  )}
                </div>
                <span className="flex-1">{d.name}</span>
                <button
                  type="button"
                  className="text-sm font-medium text-moss underline underline-offset-4"
                  onClick={() => {
                    setName(d.name);
                    go({ kind: "capture" });
                  }}
                >
                  Replace
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
          {error}
        </div>
      )}

      {step.kind === "name" && (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameIsValid) go({ kind: "capture" });
          }}
        >
          <label htmlFor="guest-name" className="font-medium">
            {myDesigns.length ? "Adding for someone else?" : "Who is this design from?"}
          </label>
          <div className="mt-2">
            {!typingName ? (
              <select id="guest-name" className={field} value={name} onChange={(e) => setName(e.target.value)}>
                <option value="">Choose your name</option>
                {guestNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="guest-name"
                className={field}
                value={name}
                maxLength={80}
                autoComplete="name"
                placeholder="Your name, e.g. Aunt Mimi"
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </div>
          {guestNames.length > 0 && !requireGuestList && (
            <button
              type="button"
              className="mt-2 text-sm text-moss underline underline-offset-4"
              onClick={() => {
                setTypingName((t) => !t);
                setName("");
              }}
            >
              {typingName ? "Pick from the guest list instead" : "My name isn't listed"}
            </button>
          )}
          <p className="mt-2 text-sm text-ink-soft">This is how your square will be labelled for the host.</p>
          <button type="submit" disabled={!nameIsValid} className={`${primary} mt-6 w-full`}>
            Next
          </button>
        </form>
      )}

      {step.kind === "capture" && (
        <section className="mt-6">
          <p className="text-ink-soft">
            Adding for <span className="font-medium text-ink">{name.trim()}</span>.{" "}
            <button type="button" className="text-moss underline underline-offset-4" onClick={() => go({ kind: "name" })}>
              Change
            </button>
          </p>

          <div className="mt-5 rounded-2xl bg-blush-soft p-4 text-sm">
            <p className="font-medium">For the best photo</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
              <li>Lay the card flat in good, even light</li>
              <li>Hold your phone straight above it</li>
              <li>Fill most of the frame with the card</li>
            </ul>
          </div>

          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          <input ref={libraryInput} type="file" accept="image/*" className="hidden" onChange={onPhoto} />

          <div className="mt-6 flex flex-col gap-3">
            <button type="button" className={primary} onClick={() => cameraInput.current?.click()}>
              Take a photo of my card
            </button>
            <button type="button" className={secondary} onClick={() => libraryInput.current?.click()}>
              Choose a photo
            </button>
            {allowDrawing && (
              <button type="button" className={secondary} onClick={() => go({ kind: "draw" })}>
                Draw on screen instead
              </button>
            )}
          </div>
        </section>
      )}

      {step.kind === "draw" && <DrawPad onDone={onDrawn} onCancel={() => go({ kind: "capture" })} />}

      {step.kind === "processing" && (
        <section className="mt-10 flex flex-col items-center text-center" aria-live="polite">
          <div className="size-10 animate-spin rounded-full border-4 border-blush border-t-moss" />
          <p className="mt-4 font-medium">Cleaning up your drawing…</p>
          <p className="mt-1 text-sm text-ink-soft">Cropping and removing the white paper.</p>
        </section>
      )}

      {(step.kind === "review" || step.kind === "uploading") && (
        <section className="mt-6">
          <h2 className="pp-script text-center" style={{ fontSize: "2.4rem", color: "var(--pp-accent)" }}>Here's your square</h2>
          <BlanketPreview url={step.prepared.designUrl} />

          {step.prepared.result.warnings.map((w) => (
            <div key={w} className="mt-4 rounded-xl border border-warn/30 bg-warn-soft p-4">
              <p className="font-medium text-warn">{WARNING_TEXT[w].title}</p>
              <p className="mt-1 text-sm text-ink">{WARNING_TEXT[w].body}</p>
            </div>
          ))}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className={primary}
              disabled={step.kind === "uploading" || step.prepared.result.warnings.includes("no-drawing")}
              onClick={() => submit(step.prepared, step.source)}
            >
              {step.kind === "uploading" ? "Adding to the blanket…" : "Add to the blanket"}
            </button>
            <button
              type="button"
              className={secondary}
              disabled={step.kind === "uploading"}
              onClick={() => go({ kind: step.source === "drawn" ? "draw" : "capture" })}
            >
              {step.source === "drawn" ? "Draw again" : "Retake photo"}
            </button>
          </div>
        </section>
      )}

      {step.kind === "done" && (
        <section className="mt-6 text-center">
          <BlanketPreview url={step.designUrl} />
          <h2 className="pp-script mt-6" style={{ fontSize: "2.8rem", color: "var(--pp-accent)" }}>It's on the blanket!</h2>
          <p className="mt-2 text-ink-soft">
            Thank you, {name.trim()}. You can come back and replace it any time before the deadline.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a href={`/p/${slug}`} className={primary}>
              Back to the party
            </a>
            <button
              type="button"
              className={secondary}
              onClick={() => {
                setName("");
                go({ kind: "name" });
              }}
            >
              Add a design for someone else
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** The design on a soft blanket square with a stitched edge. */
function BlanketPreview({ url }: { url: string }) {
  return (
    <div className="blanket-texture mt-4 rounded-2xl border border-line p-3 shadow-sm">
      <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink/15 p-[10%]">
        <img src={url} alt="Your design on the blanket" className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}

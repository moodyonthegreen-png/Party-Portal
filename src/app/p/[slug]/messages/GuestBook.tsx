"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "@/lib/messages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { deleteMyMessage, finishMessage, postMessage } from "./actions";
import { VoiceRecorder, type Recording } from "./VoiceRecorder";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type Attachment =
  | { kind: "none" }
  | { kind: "voice"; recording: Recording | null }
  | { kind: "video"; file: File; url: string };

type Page =
  | { kind: "title" }
  | { kind: "entry"; message: Message }
  | { kind: "filler" }
  | { kind: "write" };

/** Two-page spread on wider screens, one page at a time on phones. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

export function GuestBook({
  slug,
  guestOfHonorName,
  messages,
}: {
  slug: string;
  guestOfHonorName: string;
  messages: Message[];
}) {
  const router = useRouter();
  const wide = useWide();
  const nameKey = `pp_name_${slug}`;

  // The book reads oldest first; the blank page to write on is always last
  const pages = useMemo<Page[]>(() => {
    const list: Page[] = [{ kind: "title" }];
    for (const m of [...messages].reverse()) list.push({ kind: "entry", message: m });
    if (wide && list.length % 2 === 0) list.push({ kind: "filler" }); // keep the blank page on the right
    list.push({ kind: "write" });
    return list;
  }, [messages, wide]);

  const last = pages.length - 1;
  const step = wide ? 2 : 1;
  const [first, setFirst] = useState(0); // index of the left (or only) page shown
  const [turn, setTurn] = useState(0); // bumps to replay the page-turn animation
  const [dir, setDir] = useState(1);

  // Open at the blank page, and again after posting
  useEffect(() => {
    setFirst(wide ? last - (last % 2) : last);
  }, [last, wide]);

  const go = (to: number) => {
    const clamped = Math.max(0, Math.min(to, wide ? last - (last % 2) : last));
    setDir(clamped > first ? 1 : -1);
    setFirst(clamped);
    setTurn((t) => t + 1);
  };

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<Attachment>({ kind: "none" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const writeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [nameKey]);

  const media =
    attachment.kind === "voice" && attachment.recording
      ? { blob: attachment.recording.blob, mime: attachment.recording.mime }
      : attachment.kind === "video"
        ? { blob: attachment.file as Blob, mime: attachment.file.type || "video/mp4" }
        : null;
  const canPost = name.trim().length > 0 && (body.trim().length > 0 || media !== null) && !busy;
  const showingWrite = first === last || (wide && first + 1 === last);

  function pickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      setError("That video is too big (the limit is 50 MB). Try a shorter clip, around 30 seconds.");
      return;
    }
    setError(null);
    setAttachment({ kind: "video", file, url: URL.createObjectURL(file) });
  }

  async function sign() {
    if (!canPost) {
      setError(!name.trim() ? "Please sign your name at the bottom of the page." : "Write a note, or add a voice memo or video.");
      return;
    }
    setError(null);
    setBusy(media ? "Uploading…" : "Signing…");
    try {
      try {
        localStorage.setItem(nameKey, name.trim());
      } catch {
        /* ignore */
      }
      const res = await postMessage(slug, {
        name,
        body,
        media: media ? { mime: media.mime, size: media.blob.size } : null,
      });
      if (!res.ok) throw new Error(res.error);

      if (res.upload && media) {
        const { error: upErr } = await supabaseBrowser()
          .storage.from("media")
          .uploadToSignedUrl(res.upload.path, res.upload.token, media.blob, { contentType: media.mime.split(";")[0] });
        if (upErr) throw new Error("Your recording didn't finish uploading. Check your connection and try again.");
        const done = await finishMessage(slug, res.id);
        if (!done.ok) throw new Error(done.error);
      }

      setBody("");
      setAttachment({ kind: "none" });
      setSigned(true);
      setTimeout(() => setSigned(false), 5000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove your note from the guest book?")) return;
    const res = await deleteMyMessage(slug, id);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  const renderPage = (page: Page | undefined, index: number) => {
    if (!page) return <div className="pp-bpage" key={`empty-${index}`} />;
    const num = index > 0 ? <div className="pp-bpage-num">{index}</div> : null;

    switch (page.kind) {
      case "title":
        return (
          <div className="pp-bpage" key="title" style={{ background: "var(--pp-paper)", justifyContent: "center", textAlign: "center" }}>
            <p className="pp-caps pp-soft" style={{ fontSize: "0.7rem" }}>
              Guest book
            </p>
            <p className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)", margin: "0.6rem 0" }}>
              For {guestOfHonorName}
            </p>
            <p className="pp-hand" style={{ fontSize: "1.3rem", color: "var(--pp-ink-soft)" }}>
              {messages.length === 0
                ? "No notes yet. Be the first to sign!"
                : `${messages.length} ${messages.length === 1 ? "note" : "notes"} from people who love you`}
            </p>
          </div>
        );
      case "filler":
        return <div className="pp-bpage" key="filler" />;
      case "write":
        return (
          <div className="pp-bpage" key="write">
            <label htmlFor="gb-note" className="pp-hand" style={{ fontSize: "1.6rem", height: 48, color: "var(--pp-accent)" }}>
              Dear {guestOfHonorName},
            </label>
            <textarea
              id="gb-note"
              ref={writeRef}
              className="pp-book-write"
              maxLength={1500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your note here…"
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: 6 }}>
              <label htmlFor="gb-name" className="pp-hand" style={{ fontSize: "1.4rem" }}>
                Love,
              </label>
              <input
                id="gb-name"
                className="pp-book-sign"
                value={name}
                maxLength={80}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="your name"
              />
            </div>
            {attachment.kind === "none" && (
              <div style={{ display: "flex", gap: "1rem", marginTop: 10, fontSize: "0.85rem", flexWrap: "wrap" }}>
                <button type="button" className="pp-link" onClick={() => setAttachment({ kind: "voice", recording: null })}>
                  Voice memo
                </button>
                <button type="button" className="pp-link" onClick={() => videoInput.current?.click()}>
                  Video
                </button>
              </div>
            )}
            {attachment.kind !== "none" && (
              <p className="pp-soft" style={{ marginTop: 10, fontSize: "0.85rem" }}>
                {attachment.kind === "video" ? "Video attached below" : "Voice memo below"}
              </p>
            )}
            {num}
          </div>
        );
      case "entry": {
        const m = page.message;
        return (
          <div className="pp-bpage" key={m.id}>
            <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem", height: 48 }}>
              {new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
            <div className="pp-bpage-scroll">
              {m.body && <p className="pp-bpage-text">{m.body}</p>}
              {m.mediaType === "audio" && m.mediaUrl && (
                <audio src={m.mediaUrl} controls preload="none" style={{ width: "100%", marginTop: 8 }} />
              )}
              {m.mediaType === "video" && m.mediaUrl && (
                <video
                  src={m.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: "100%", maxHeight: 220, marginTop: 8, borderRadius: 6, background: "#000" }}
                />
              )}
            </div>
            <p className="pp-script" style={{ fontSize: "2rem", textAlign: "right", color: "var(--pp-accent)", lineHeight: 1.1 }}>
              — {m.authorName}
            </p>
            {m.mine && (
              <button type="button" className="pp-link" onClick={() => remove(m.id)} style={{ alignSelf: "flex-end", fontSize: "0.75rem", marginBottom: 10 }}>
                Remove my note
              </button>
            )}
            {num}
          </div>
        );
      }
    }
  };

  const shown = wide ? [pages[first], pages[first + 1]] : [pages[first]];
  const atStart = first === 0;
  const atEnd = showingWrite;

  return (
    <>
      <div className="pp-book" data-wide={wide}>
        <div
          key={turn}
          className={`pp-book-pages ${turn ? "pp-book-turn" : ""}`}
          style={{ "--turn-from": `${dir * 14}px` } as React.CSSProperties}
        >
          {shown.map((p, i) => renderPage(p, first + i))}
        </div>
      </div>

      <div className="pp-book-nav">
        <button type="button" className="pp-link pp-caps" style={{ fontSize: "0.72rem", visibility: atStart ? "hidden" : "visible" }} onClick={() => go(first - step)}>
          ← Previous
        </button>
        <span className="pp-soft" style={{ fontSize: "0.85rem" }}>
          {first === 0 ? "First page" : wide ? `Pages ${first}–${first + 1}` : `Page ${first} of ${last}`}
        </span>
        <button type="button" className="pp-link pp-caps" style={{ fontSize: "0.72rem", visibility: atEnd ? "hidden" : "visible" }} onClick={() => go(first + step)}>
          Next →
        </button>
      </div>

      <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={pickVideo} />

      {showingWrite ? (
        <div style={{ marginTop: "1.25rem", display: "grid", gap: "0.9rem" }}>
          {attachment.kind === "voice" && (
            <VoiceRecorder
              value={attachment.recording}
              onChange={(recording) => setAttachment({ kind: "voice", recording })}
              onCancel={() => setAttachment({ kind: "none" })}
            />
          )}
          {attachment.kind === "video" && (
            <div className="pp-note" style={{ display: "grid", gap: "0.6rem" }}>
              <video src={attachment.url} controls playsInline style={{ width: "100%", maxHeight: 320, borderRadius: 8, background: "#000" }} />
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="button" className="pp-link" onClick={() => videoInput.current?.click()}>
                  Choose a different video
                </button>
                <button type="button" className="pp-link" onClick={() => setAttachment({ kind: "none" })}>
                  Remove
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" style={{ color: "var(--pp-leather)" }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="pp-btn" onClick={sign} disabled={!!busy}>
              {busy ?? "Sign the guest book"}
            </button>
            {signed && (
              <span role="status" style={{ color: "var(--pp-accent)" }}>
                Signed! Thank you. Flip back a page to see your note.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
          <button
            type="button"
            className="pp-btn pp-btn-ghost"
            onClick={() => {
              go(wide ? last - (last % 2) : last);
              setTimeout(() => writeRef.current?.focus(), 400);
            }}
          >
            Write your note
          </button>
          {error && (
            <p role="alert" style={{ color: "var(--pp-leather)", marginTop: "0.75rem" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}

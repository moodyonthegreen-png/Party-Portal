"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/messages";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { deleteMyMessage, finishMessage, postMessage } from "./actions";
import { VoiceRecorder, type Recording } from "./VoiceRecorder";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type Attachment =
  | { kind: "none" }
  | { kind: "voice"; recording: Recording | null }
  | { kind: "video"; file: File; url: string };

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MessageBoard({
  slug,
  guestOfHonorName,
  messages,
}: {
  slug: string;
  guestOfHonorName: string;
  theme: string;
  messages: Message[];
}) {
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<Attachment>({ kind: "none" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(false);

  // Remember the guest's name on this device for next time
  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
    setNow(true); // render relative times only in the browser
  }, [nameKey]);

  const media =
    attachment.kind === "voice" && attachment.recording
      ? { blob: attachment.recording.blob, mime: attachment.recording.mime }
      : attachment.kind === "video"
        ? { blob: attachment.file as Blob, mime: attachment.file.type || "video/mp4" }
        : null;

  const canPost = name.trim().length > 0 && (body.trim().length > 0 || media !== null) && !busy;

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setError(null);
    setBusy(media ? "Uploading…" : "Posting…");
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
          .uploadToSignedUrl(res.upload.path, res.upload.token, media.blob, {
            contentType: media.mime.split(";")[0],
          });
        if (upErr) throw new Error("Your recording didn't finish uploading. Check your connection and try again.");
        const done = await finishMessage(slug, res.id);
        if (!done.ok) throw new Error(done.error);
      }

      setBody("");
      setAttachment({ kind: "none" });
      setPosted(true);
      setTimeout(() => setPosted(false), 4000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete your note?")) return;
    const res = await deleteMyMessage(slug, id);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <>
      {/* Composer */}
      <form
        onSubmit={submit}
        className="pp-paper"
        style={{ marginTop: "1.75rem", padding: "1.6rem 1.25rem", transform: "rotate(-0.6deg)", display: "grid", gap: "0.9rem" }}
      >
        <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(2deg)" }} />
        <div>
          <label htmlFor="msg-name" className="pp-caps" style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" }}>
            Your name
          </label>
          <input
            id="msg-name"
            className="pp-field"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aunt Mimi"
          />
        </div>
        <div>
          <label htmlFor="msg-body" className="pp-caps" style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" }}>
            Your note for {guestOfHonorName}
          </label>
          <textarea
            id="msg-body"
            className="pp-field"
            rows={4}
            maxLength={1500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="A wish, a piece of advice, a favorite memory…"
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {attachment.kind === "none" && (
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            <button type="button" className="pp-link" onClick={() => setAttachment({ kind: "voice", recording: null })}>
              🎙 Add a voice memo
            </button>
            <button type="button" className="pp-link" onClick={() => videoInput.current?.click()}>
              🎥 Add a short video
            </button>
          </div>
        )}
        <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={pickVideo} />

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
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button className="pp-btn" disabled={!canPost}>
            {busy ?? "Post my note"}
          </button>
          {posted && (
            <span role="status" style={{ color: "var(--pp-accent)" }}>
              Posted! Thank you.
            </span>
          )}
        </div>
      </form>

      {/* Notes */}
      <section style={{ marginTop: "2.5rem" }} aria-label="Notes">
        {messages.length === 0 ? (
          <p className="pp-soft" style={{ textAlign: "center" }}>
            No notes yet. Be the first to leave one!
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.5rem" }}>
            {messages.map((m, i) => (
              <li
                key={m.id}
                className="pp-paper"
                style={{
                  padding: "1.25rem 1.2rem 1rem",
                  transform: `rotate(${[-1.2, 0.8, -0.4, 1.1][i % 4]}deg)`,
                  background:
                    "repeating-linear-gradient(180deg, transparent 0 27px, var(--pp-paper-edge) 27px 28px) 0 3.2rem / 100% calc(100% - 3.2rem) no-repeat, var(--pp-paper)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
                  <span className="pp-script" style={{ fontSize: "2rem", color: "var(--pp-accent)" }}>
                    {m.authorName}
                  </span>
                  <span className="pp-soft" style={{ fontSize: "0.8rem", marginLeft: "auto" }}>
                    {now ? timeAgo(m.createdAt) : ""}
                  </span>
                </div>
                {m.body && <p style={{ marginTop: "0.5rem", lineHeight: "28px", whiteSpace: "pre-line" }}>{m.body}</p>}
                {m.mediaType === "audio" && m.mediaUrl && (
                  <audio src={m.mediaUrl} controls preload="none" style={{ width: "100%", marginTop: "0.75rem" }} />
                )}
                {m.mediaType === "video" && m.mediaUrl && (
                  <video
                    src={m.mediaUrl}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: "100%", maxHeight: 420, marginTop: "0.75rem", borderRadius: 8, background: "#000" }}
                  />
                )}
                {m.mine && (
                  <button type="button" className="pp-link" onClick={() => remove(m.id)} style={{ marginTop: "0.6rem", fontSize: "0.85rem" }}>
                    Delete my note
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

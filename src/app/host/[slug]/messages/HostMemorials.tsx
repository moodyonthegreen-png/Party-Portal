"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { VideoRecorder } from "@/components/VideoRecorder";
import { resizeToJpeg } from "@/lib/image/resize";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { VoiceRecorder, type Recording } from "@/app/p/[slug]/messages/VoiceRecorder";
import {
  deleteMemorial,
  finishMemorialMedia,
  moveMemorial,
  removeMemorialMedia,
  saveMemorial,
  startMemorialMedia,
  type ActionState,
} from "../actions";

type Kind = "photo" | "audio" | "video";
export type MemorialItem = {
  id: string;
  name: string;
  relation: string | null;
  message: string | null;
  mediaKind: Kind | null;
  mediaUrl: string | null;
};

/** A photo, voice memo or video picked in the editor, uploaded on save */
type Pending =
  | { kind: "photo"; blob: Blob; url: string }
  | { kind: "audio"; blob: Blob; mime: string; url: string }
  | { kind: "video"; blob: Blob; mime: string; url: string };

const MAX_BYTES = 50 * 1024 * 1024;
const labelStyle: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };
const small: React.CSSProperties = { fontSize: "0.9rem", minHeight: "2.5rem", padding: "0.5rem 1rem" };

function MediaPreview({ kind, url }: { kind: Kind; url: string }) {
  if (kind === "photo") return <img src={url} alt="" className="mm-photo" />;
  if (kind === "audio") return <audio src={url} controls preload="metadata" style={{ width: "100%" }} />;
  return <video src={url} controls playsInline preload="metadata" className="wm-video" />;
}

function Editor({
  slug,
  firstName,
  suggestion,
  item,
  onDone,
}: {
  slug: string;
  firstName: string;
  suggestion: string;
  item: MemorialItem | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(item?.name ?? "");
  const [relation, setRelation] = useState(item?.relation ?? "");
  const [message, setMessage] = useState(item ? (item.message ?? "") : suggestion);
  const [pending, setPending] = useState<Pending | null>(null);
  const [recording, setRecording] = useState<"audio" | "video" | null>(null);
  const [voice, setVoice] = useState<Recording | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => (pending ? URL.revokeObjectURL(pending.url) : undefined), [pending]);

  const pickFile = (kind: Kind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (kind !== "photo" && f.size > MAX_BYTES) {
      setError("That file is too large (the limit is 50 MB). Try a shorter clip.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(f);
    setPending(kind === "photo" ? { kind, blob: f, url } : { kind, blob: f, mime: f.type || (kind === "video" ? "video/mp4" : "audio/mp4"), url });
  };

  const current = pending ? { kind: pending.kind, url: pending.url } : item?.mediaKind && item.mediaUrl ? { kind: item.mediaKind, url: item.mediaUrl } : null;

  async function save() {
    if (!name.trim()) {
      setError("Please add their name.");
      return;
    }
    setError(null);
    setBusy("Saving…");
    try {
      const res = await saveMemorial(slug, { id: item?.id ?? null, name, relation, message });
      if (!res.ok) throw new Error(res.error);
      if (pending) {
        setBusy(pending.kind === "photo" ? "Adding the photo…" : "Uploading…");
        let blob = pending.blob;
        let mime = pending.kind === "photo" ? "image/jpeg" : pending.mime;
        if (pending.kind === "photo") {
          blob = (await resizeToJpeg(pending.blob, 1800).catch(() => {
            throw new Error("That photo couldn't be opened here. Try a JPEG or PNG.");
          })).blob;
          mime = "image/jpeg";
        }
        const up = await startMemorialMedia(slug, res.id, { kind: pending.kind, mime, size: blob.size });
        if (!up.ok) throw new Error(up.error);
        const bucket = pending.kind === "photo" ? "photos" : "media";
        const { error: upErr } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(up.path, up.token, blob, { contentType: mime.split(";")[0] });
        if (upErr) throw new Error("It didn't finish uploading. Check your connection and try again.");
        const fin = await finishMemorialMedia(slug, res.id, pending.kind, up.path);
        if (fin.error) throw new Error(fin.error);
      }
      router.refresh();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function dropMedia() {
    if (pending) {
      setPending(null);
      return;
    }
    if (!item || !window.confirm("Remove this from the note?")) return;
    setBusy("Removing…");
    const res = await removeMemorialMedia(slug, item.id);
    setBusy(null);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="mm-editor">
      <div>
        <label htmlFor={`mm-name-${item?.id ?? "new"}`} className="pp-caps" style={labelStyle}>
          Their name
        </label>
        <input id={`mm-name-${item?.id ?? "new"}`} className="pp-field" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Grandma Rose" />
      </div>
      <div>
        <label htmlFor={`mm-rel-${item?.id ?? "new"}`} className="pp-caps" style={labelStyle}>
          Who they are to {firstName}
        </label>
        <input
          id={`mm-rel-${item?.id ?? "new"}`}
          className="pp-field"
          maxLength={80}
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          placeholder={`${firstName}'s mom, Grandma, Uncle Joe…`}
        />
      </div>
      <div>
        <label htmlFor={`mm-msg-${item?.id ?? "new"}`} className="pp-caps" style={labelStyle}>
          Message
        </label>
        <textarea
          id={`mm-msg-${item?.id ?? "new"}`}
          className="pp-field"
          rows={3}
          maxLength={1500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={suggestion}
          style={{ resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        <span className="pp-caps" style={labelStyle}>
          A photo, voice memo or video (optional)
        </span>
        {recording === "audio" ? (
          <>
            <VoiceRecorder value={voice} onChange={setVoice} onCancel={() => { setRecording(null); setVoice(null); }} />
            {voice && (
              <div>
                <button
                  type="button"
                  className="pp-btn"
                  style={small}
                  onClick={() => {
                    setPending({ kind: "audio", blob: voice.blob, mime: voice.mime, url: URL.createObjectURL(voice.blob) });
                    setRecording(null);
                    setVoice(null);
                  }}
                >
                  Use this recording
                </button>
              </div>
            )}
          </>
        ) : recording === "video" ? (
          <VideoRecorder
            onDone={(blob, mime) => {
              setPending({ kind: "video", blob, mime, url: URL.createObjectURL(blob) });
              setRecording(null);
            }}
            onCancel={() => setRecording(null)}
          />
        ) : current ? (
          <>
            <MediaPreview kind={current.kind} url={current.url} />
            <div className="pb-actions">
              <button type="button" className="pp-link" style={{ color: "var(--pp-leather)" }} disabled={Boolean(busy)} onClick={dropMedia}>
                Remove {current.kind === "photo" ? "photo" : current.kind === "audio" ? "voice memo" : "video"}
              </button>
            </div>
          </>
        ) : (
          <div className="mm-media-choices">
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => photoInput.current?.click()}>
              Add a photo
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => setRecording("audio")}>
              Record a voice memo
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => audioInput.current?.click()}>
              Upload a voice recording
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => setRecording("video")}>
              Record a video
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => videoInput.current?.click()}>
              Upload a video
            </button>
          </div>
        )}
        <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={pickFile("photo")} />
        <input ref={audioInput} type="file" accept="audio/*,.m4a,.mp3,.wav" className="hidden" onChange={pickFile("audio")} />
        <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={pickFile("video")} />
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {error}
        </p>
      )}
      <div className="pb-actions">
        <button type="button" className="pp-btn" style={small} disabled={Boolean(busy) || recording !== null} onClick={save}>
          {busy ?? (item ? "Save changes" : "Add to the guest book")}
        </button>
        <button type="button" className="pp-link" disabled={Boolean(busy)} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function HostMemorials({
  slug,
  firstName,
  items,
  ready,
  max,
  suggestion,
}: {
  slug: string;
  firstName: string;
  items: MemorialItem[];
  ready: boolean;
  max: number;
  suggestion: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      router.refresh();
    });
  };

  return (
    <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", display: "grid", gap: "1rem", opacity: pending ? 0.7 : 1 }} id="memorials">
      <div>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          In loving memory
        </h2>
        <p className="pp-soft" style={{ marginTop: "0.4rem", fontSize: "1rem" }}>
          Optional. Honor loved ones who can&apos;t be there. Each memorial note opens the guest book, ahead of every guest&apos;s
          note, and gets its own page in {firstName}&apos;s keepsake.
        </p>
      </div>

      {!ready ? (
        <p className="pp-note">Memorial notes aren&apos;t switched on yet. Moody Celebrations needs to run one quick database update first.</p>
      ) : (
        <>
          {items.length > 0 && (
            <ul className="mm-list">
              {items.map((m, i) =>
                editing === m.id ? (
                  <li key={m.id}>
                    <Editor slug={slug} firstName={firstName} suggestion={suggestion} item={m} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={m.id} className="mm-item">
                    {m.mediaKind === "photo" && m.mediaUrl ? (
                      <img src={m.mediaUrl} alt="" className="mm-thumb" />
                    ) : (
                      <span className="mm-thumb mm-thumb-blank" aria-hidden="true">
                        {m.mediaKind === "audio" ? "♪" : m.mediaKind === "video" ? "▶" : "✦"}
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600 }}>{m.name}</p>
                      {m.relation && <p className="pp-soft" style={{ fontSize: "0.9rem" }}>{m.relation}</p>}
                      {m.message && <p className="pp-serif-italic mm-excerpt">{m.message}</p>}
                      <div className="mm-tools">
                        <button type="button" className="pp-link" onClick={() => setEditing(m.id)}>
                          Edit
                        </button>
                        <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => run(() => moveMemorial(slug, m.id, -1))}>
                          ↑
                        </button>
                        <button type="button" aria-label="Move later" disabled={i === items.length - 1} onClick={() => run(() => moveMemorial(slug, m.id, 1))}>
                          ↓
                        </button>
                        <button
                          type="button"
                          className="pp-link"
                          style={{ color: "var(--pp-leather)" }}
                          onClick={() => run(() => deleteMemorial(slug, m.id), `Remove the memorial note for ${m.name}?`)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}

          {editing === "new" ? (
            <Editor slug={slug} firstName={firstName} suggestion={suggestion} item={null} onDone={() => setEditing(null)} />
          ) : items.length < max ? (
            <div>
              <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => setEditing("new")}>
                {items.length ? "Add another memorial note" : "Add a memorial note"}
              </button>
            </div>
          ) : (
            <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
              You&apos;ve added the most memorial notes ({max}).
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

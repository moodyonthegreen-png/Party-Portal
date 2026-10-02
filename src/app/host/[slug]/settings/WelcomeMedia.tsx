"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { VideoRecorder } from "@/components/VideoRecorder";
import { resizeToJpeg } from "@/lib/image/resize";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  deleteWelcomePhoto,
  finishWelcomePhoto,
  finishWelcomeVideo,
  moveWelcomePhoto,
  removeWelcomeVideo,
  setWelcomePhotoCaption,
  startWelcomePhoto,
  startWelcomeVideo,
  type ActionState,
} from "../actions";

type Photo = { id: string; url: string; caption: string | null };

const card: React.CSSProperties = { padding: "1.5rem 1.25rem", display: "grid", gap: "1.1rem" };
const small: React.CSSProperties = { fontSize: "0.9rem", minHeight: "2.5rem", padding: "0.5rem 1rem" };

export function WelcomeMedia({
  slug,
  firstName,
  video,
  photos,
  ready,
  maxPhotos,
}: {
  slug: string;
  firstName: string;
  video: { url: string; by: string | null } | null;
  photos: Photo[];
  ready: boolean;
  maxPhotos: number;
}) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const videoFile = useRef<HTMLInputElement>(null);
  const photoFiles = useRef<HTMLInputElement>(null);

  async function uploadVideo(blob: Blob, mime: string) {
    setRecording(false);
    setMsg(null);
    setBusy("Uploading your video…");
    try {
      const res = await startWelcomeVideo(slug, { mime, size: blob.size });
      if (!res.ok) throw new Error(res.error);
      const { error } = await supabaseBrowser().storage.from("media").uploadToSignedUrl(res.path, res.token, blob, { contentType: mime.split(";")[0] });
      if (error) throw new Error("The video didn't finish uploading. Check your connection and try again.");
      const fin = await finishWelcomeVideo(slug, res.path);
      if (fin.error) throw new Error(fin.error);
      setMsg(fin);
      router.refresh();
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  async function addPhotos(files: File[]) {
    setMsg(null);
    const room = maxPhotos - photos.length;
    const list = files.slice(0, Math.max(0, room));
    if (files.length > room) setMsg({ error: `You can share up to ${maxPhotos} photos here.` });
    for (let i = 0; i < list.length; i++) {
      setBusy(`Adding photo ${i + 1} of ${list.length}…`);
      try {
        const img = await resizeToJpeg(list[i], 1800).catch(() => {
          throw new Error("One photo couldn't be opened here. Try a JPEG or PNG.");
        });
        const res = await startWelcomePhoto(slug);
        if (!res.ok) throw new Error(res.error);
        const { error } = await supabaseBrowser().storage.from("photos").uploadToSignedUrl(res.path, res.token, img.blob, { contentType: "image/jpeg" });
        if (error) throw new Error("A photo didn't finish uploading. Check your connection.");
        const fin = await finishWelcomePhoto(slug, res.id, "");
        if (fin.error) throw new Error(fin.error);
      } catch (e) {
        setMsg({ error: e instanceof Error ? e.message : "Something went wrong." });
        break;
      }
    }
    setBusy(null);
    router.refresh();
  }

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMsg(res);
      router.refresh();
    });
  };

  return (
    <section className="pp-paper" style={{ ...card, opacity: pending ? 0.7 : 1 }} id="welcome">
      <div>
        <h2 className="pp-caps">Welcome video and photos</h2>
        <p className="pp-soft" style={{ marginTop: "0.35rem" }}>
          Optional. These sit at the top of the party page with your welcome message, the first thing guests see.
        </p>
      </div>

      {!ready ? (
        <p className="pp-note">Welcome videos and photos aren&apos;t switched on yet. Moody Celebrations needs to run one quick database update first.</p>
      ) : (
        <>
          {/* Video */}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 className="pp-caps">A welcome video</h3>
            {recording ? (
              <VideoRecorder onDone={uploadVideo} onCancel={() => setRecording(false)} />
            ) : video ? (
              <>
                <video src={video.url} controls playsInline preload="metadata" className="wm-video" />
                {video.by && <p className="pp-soft" style={{ fontSize: "0.85rem" }}>Recorded by {video.by}</p>}
                <div className="pb-actions">
                  <button type="button" className="pp-btn pp-btn-ghost" style={small} disabled={Boolean(busy)} onClick={() => setRecording(true)}>
                    Record a new one
                  </button>
                  <button type="button" className="pp-btn pp-btn-ghost" style={small} disabled={Boolean(busy)} onClick={() => videoFile.current?.click()}>
                    Upload a different video
                  </button>
                  <button type="button" className="pp-link" style={{ color: "var(--pp-leather)" }} onClick={() => run(() => removeWelcomeVideo(slug), "Remove the welcome video?")}>
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
                  A quick hello from you or {firstName}: thank everyone for coming, share what you&apos;re excited about, or tell
                  them what to do at the party. Up to 3 minutes.
                </p>
                <div className="pb-actions">
                  <button type="button" className="pp-btn" style={small} disabled={Boolean(busy)} onClick={() => setRecording(true)}>
                    Record a video
                  </button>
                  <button type="button" className="pp-btn pp-btn-ghost" style={small} disabled={Boolean(busy)} onClick={() => videoFile.current?.click()}>
                    Upload a video
                  </button>
                </div>
              </>
            )}
            <input
              ref={videoFile}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadVideo(f, f.type || "video/mp4");
              }}
            />
          </div>

          {/* Photos */}
          <div style={{ display: "grid", gap: "0.75rem", borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1.1rem" }}>
            <h3 className="pp-caps">
              Photos to share ({photos.length} of {maxPhotos})
            </h3>
            <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
              Bump photos, the ultrasound, the nursery, the two of you: anything guests would love to see.
            </p>
            {photos.length > 0 && (
              <ul className="wm-photos">
                {photos.map((p, i) => (
                  <li key={p.id}>
                    <img src={p.url} alt="" />
                    <input
                      className="pp-field"
                      style={{ fontSize: "0.9rem", padding: "0.45rem 0.6rem" }}
                      defaultValue={p.caption ?? ""}
                      maxLength={140}
                      placeholder="Caption (optional)"
                      onBlur={(e) => {
                        if (e.target.value !== (p.caption ?? "")) run(() => setWelcomePhotoCaption(slug, p.id, e.target.value));
                      }}
                    />
                    <div className="wm-photo-tools">
                      <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => run(() => moveWelcomePhoto(slug, p.id, -1))}>
                        ←
                      </button>
                      <button type="button" aria-label="Move later" disabled={i === photos.length - 1} onClick={() => run(() => moveWelcomePhoto(slug, p.id, 1))}>
                        →
                      </button>
                      <button type="button" className="pp-link" style={{ color: "var(--pp-leather)", fontSize: "0.85rem" }} onClick={() => run(() => deleteWelcomePhoto(slug, p.id), "Remove this photo?")}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {photos.length < maxPhotos && (
              <div>
                <button type="button" className="pp-btn pp-btn-ghost" style={small} disabled={Boolean(busy)} onClick={() => photoFiles.current?.click()}>
                  Add photos
                </button>
              </div>
            )}
            <input
              ref={photoFiles}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files: File[] = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void addPhotos(files);
              }}
            />
          </div>
        </>
      )}

      {busy && <p className="pp-soft">{busy}</p>}
      {msg?.error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {msg.error}
        </p>
      )}
      {msg?.message && <p style={{ color: "var(--pp-accent)" }}>{msg.message}</p>}
    </section>
  );
}

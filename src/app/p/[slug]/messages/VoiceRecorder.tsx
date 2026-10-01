"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 120;

/** Best recording format this browser supports (Safari: mp4, Chrome/Firefox: webm). */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export type Recording = { blob: Blob; mime: string; url: string; seconds: number };

/**
 * Record a short voice memo in the browser. Hands the finished recording
 * to onChange (or null when it's removed).
 */
export function VoiceRecorder({
  value,
  onChange,
  onCancel,
}: {
  value: Recording | null;
  onChange: (r: Recording | null) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);

  const stopTracks = () => recorder.current?.stream.getTracks().forEach((t) => t.stop());

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      stopTracks();
    };
  }, []);

  async function start() {
    setError(null);
    const mime = pickMime();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice memos aren't supported in this browser. Try Safari or Chrome.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("We need permission to use your microphone. Check your browser settings and try again.");
      return;
    }
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      if (timer.current) clearInterval(timer.current);
      stream.getTracks().forEach((t) => t.stop());
      const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
      setState("idle");
      if (blob.size > 0) onChange({ blob, mime: type, url: URL.createObjectURL(blob), seconds: secs });
    };
    recorder.current = rec;
    started.current = Date.now();
    setSeconds(0);
    rec.start(250);
    setState("recording");
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) rec.stop();
    }, 250);
  }

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="pp-note" style={{ display: "grid", gap: "0.6rem" }}>
      {value ? (
        <>
          <p className="pp-caps" style={{ fontSize: "0.7rem" }}>
            Your voice memo ({fmt(value.seconds)})
          </p>
          <audio src={value.url} controls style={{ width: "100%" }} />
          <div style={{ display: "flex", gap: "1rem" }}>
            <button type="button" className="pp-link" onClick={() => onChange(null)}>
              Record again
            </button>
            <button type="button" className="pp-link" onClick={onCancel}>
              Remove
            </button>
          </div>
        </>
      ) : state === "recording" ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          <span
            aria-hidden="true"
            style={{ width: 12, height: 12, borderRadius: 99, background: "#c0392b", animation: "pp-pulse 1s infinite" }}
          />
          <span className="pp-display" style={{ fontSize: "1.3rem", fontVariantNumeric: "tabular-nums" }}>
            {fmt(seconds)}
          </span>
          <span className="pp-soft" style={{ fontSize: "0.85rem" }}>
            up to {fmt(MAX_SECONDS)}
          </span>
          <button type="button" className="pp-btn" onClick={stop} style={{ marginLeft: "auto", fontSize: "0.75rem", padding: "0.6rem 1rem" }}>
            Stop
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", flexWrap: "wrap" }}>
          <button type="button" className="pp-btn" onClick={start} style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }}>
            ● Start recording
          </button>
          <button type="button" className="pp-link" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
      {error && <p style={{ color: "var(--pp-leather)", fontSize: "0.95rem" }}>{error}</p>}
    </div>
  );
}

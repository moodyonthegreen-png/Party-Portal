"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 180;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Record a short video with the front camera. Hands back the finished clip;
 * the caller decides what to do with it.
 */
export function VideoRecorder({ onDone, onCancel }: { onDone: (blob: Blob, mime: string) => void; onCancel: () => void }) {
  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<"starting" | "ready" | "recording" | "review" | "error">("starting");
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  async function start() {
    setState("starting");
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record video. You can upload a video instead.");
      setState("error");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      if (live.current) {
        live.current.srcObject = stream.current;
        await live.current.play().catch(() => {});
      }
      setState("ready");
    } catch {
      setError("We couldn't open your camera. Check that this site is allowed to use the camera and microphone, or upload a video instead.");
      setState("error");
    }
  }

  useEffect(() => {
    void start();
    return () => {
      if (timer.current) clearInterval(timer.current);
      stopStream();
    };
  }, []);

  function record() {
    if (!stream.current) return;
    const mime = pickMime();
    // Modest bitrate keeps a 3 minute clip under the 50 MB upload limit
    const rec = new MediaRecorder(stream.current, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1_600_000, audioBitsPerSecond: 96_000 });
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunks.current, { type });
      setClip({ blob, url: URL.createObjectURL(blob), mime: type });
      setState("review");
      stopStream();
    };
    recorder.current = rec;
    rec.start(1000);
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function again() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    void start();
  }

  return (
    <div className="vr">
      <div className="vr-screen">
        {state === "review" && clip ? (
          <video src={clip.url} controls playsInline />
        ) : (
          <video ref={live} muted playsInline autoPlay style={{ transform: "scaleX(-1)" }} />
        )}
        {state === "recording" && (
          <span className="vr-rec">
            <span aria-hidden="true" /> {fmt(seconds)} / {fmt(MAX_SECONDS)}
          </span>
        )}
        {state === "starting" && <span className="vr-msg">Opening your camera…</span>}
        {state === "error" && <span className="vr-msg">{error}</span>}
      </div>
      <div className="pb-actions">
        {state === "ready" && (
          <button type="button" className="pp-btn" onClick={record}>
            Start recording
          </button>
        )}
        {state === "recording" && (
          <button type="button" className="pp-btn" onClick={stop}>
            Stop
          </button>
        )}
        {state === "review" && clip && (
          <>
            <button type="button" className="pp-btn" onClick={() => onDone(clip.blob, clip.mime)}>
              Use this video
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" onClick={again}>
              Record again
            </button>
          </>
        )}
        <button
          type="button"
          className="pp-link"
          onClick={() => {
            stop();
            stopStream();
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

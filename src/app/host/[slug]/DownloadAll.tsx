"use client";

import { useState } from "react";
import type { DownloadSection } from "@/lib/download";
import { ZipWriter } from "@/lib/zip";
import { getDownloadManifest } from "./actions";

const small: React.CSSProperties = { fontSize: "0.8rem", padding: "0.7rem 1rem" };
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(n < 100 * 1024 * 1024 ? 1 : 0)} MB`);

async function fetchBytes(url: string): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 1) throw e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

export function DownloadAll({ slug, counts }: { slug: string; counts: { notes: number; media: number; photos: number; designs: number } }) {
  const [busy, setBusy] = useState<DownloadSection | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; bytes: number } | null>(null);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);

  async function run(section: DownloadSection) {
    setBusy(section);
    setMessage(null);
    setProgress(null);
    try {
      const res = await getDownloadManifest(slug, section);
      if (!res.manifest) throw new Error(res.error ?? "Something went wrong.");
      const { files, texts, zipName } = res.manifest;

      const zip = new ZipWriter();
      const enc = new TextEncoder();
      for (const t of texts) zip.add({ name: t.name, data: enc.encode(t.content) });

      // Fetch a few at a time, but add to the zip in order
      const results: (Uint8Array | null)[] = new Array(files.length).fill(null);
      const failed: string[] = [];
      let next = 0;
      let done = 0;
      let bytes = 0;
      setProgress({ done, total: files.length, bytes });
      const worker = async () => {
        while (next < files.length) {
          const i = next++;
          try {
            results[i] = await fetchBytes(files[i].url);
            bytes += results[i]!.length;
          } catch {
            failed.push(files[i].name);
          }
          done++;
          setProgress({ done, total: files.length, bytes });
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));

      results.forEach((data, i) => {
        if (data) zip.add({ name: files[i].name, data });
        results[i] = null;
      });
      if (failed.length) {
        zip.add({
          name: "Files that didn't download.txt",
          data: enc.encode(`These couldn't be downloaded. Try again in a few minutes:\r\n\r\n${failed.join("\r\n")}\r\n`),
        });
      }

      const blob = new Blob(zip.finish() as BlobPart[], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setMessage(
        failed.length
          ? { error: true, text: `Saved, but ${failed.length} ${failed.length === 1 ? "file" : "files"} didn't download. There's a list inside the zip.` }
          : { text: `Saved ${zipName} (${mb(blob.size)}). Unzip it and open "Open me first".` },
      );
    } catch (e) {
      setMessage({ error: true, text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  const options: { key: DownloadSection; label: string; show: boolean }[] = [
    { key: "all", label: "Download everything", show: true },
    { key: "guestbook", label: "Just the guest book", show: counts.notes > 0 },
    { key: "photos", label: "Just the photos", show: counts.photos > 0 },
    { key: "designs", label: "Just the designs", show: counts.designs > 0 },
  ];

  return (
    <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", display: "grid", gap: "0.9rem" }}>
      <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
        Keep everything
      </h2>
      <p className="pp-soft" style={{ fontSize: "1rem" }}>
        One zip with every photo at full quality, voice memos, videos, guest book notes, designs, the gift print file and
        a guest list with gifts. Inside is an &quot;Open me first&quot; page that shows it all, even offline.
      </p>
      <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
        So far: {counts.notes} guest book {counts.notes === 1 ? "note" : "notes"}
        {counts.media ? ` (${counts.media} with voice or video)` : ""}, {counts.photos} {counts.photos === 1 ? "photo" : "photos"},{" "}
        {counts.designs} {counts.designs === 1 ? "design" : "designs"}. Best done on a computer, since videos can make it large.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {options
          .filter((o) => o.show)
          .map((o) => (
            <button key={o.key} type="button" className={o.key === "all" ? "pp-btn" : "pp-btn pp-btn-ghost"} style={small} disabled={busy !== null} onClick={() => run(o.key)}>
              {busy === o.key ? "Gathering…" : o.label}
            </button>
          ))}
      </div>
      {busy && progress && (
        <div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--pp-accent-soft)", overflow: "hidden" }}>
            <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%`, height: "100%", background: "var(--pp-accent)", transition: "width .2s" }} />
          </div>
          <p className="pp-soft" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
            {progress.done} of {progress.total} files · {mb(progress.bytes)}. Keep this tab open.
          </p>
        </div>
      )}
      {message && (
        <p role={message.error ? "alert" : undefined} style={{ color: message.error ? "var(--pp-leather)" : "var(--pp-accent)" }}>
          {message.text}
        </p>
      )}
    </section>
  );
}

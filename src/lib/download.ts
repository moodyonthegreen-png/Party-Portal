import "server-only";
import { listBabyGuesses, listBabyPhotos, listPoolEntries } from "@/lib/games";
import { formatWeight, scoreBabyPhotos, scorePool } from "@/lib/games/scoring";
import { listGiftSources, listSavedGifts } from "@/lib/gift";
import { PRODUCTS, type ProductKey } from "@/lib/gift/products";
import type { HostParty } from "@/lib/host";
import { listMemorials } from "@/lib/memorials";
import { listMessages } from "@/lib/messages";
import { listPhotos } from "@/lib/photos";
import { listThankYous } from "@/lib/thanks";
import { extensionOf, safeFileName } from "@/lib/zip";
import { promptTag } from "@/lib/booth/prompts";

/**
 * "Download everything": the list of files for the host's browser to fetch
 * and zip, plus a self-contained "Open me first.html" page that shows it all
 * (voice memos and videos play right in the page, even offline).
 */

export type DownloadSection = "all" | "photos" | "guestbook" | "designs";
export type DownloadFile = { name: string; url: string };
export type DownloadManifest = { zipName: string; files: DownloadFile[]; texts: { name: string; content: string }[] };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const attr = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const pad = (n: number) => String(n).padStart(3, "0");
const BROWSER_IMAGES = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/** Hands out unique file names inside the zip. */
function namer() {
  const used = new Set<string>();
  return (folder: string, base: string, ext: string) => {
    let name = `${folder}/${safeFileName(base)}${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${folder}/${safeFileName(base)} (${n})${ext}`;
    used.add(name.toLowerCase());
    return name;
  };
}

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? "" : String(v);
  // Leading = + - @ could run as a formula in a spreadsheet
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function buildDownload(party: HostParty, section: DownloadSection): Promise<DownloadManifest> {
  const want = (s: Exclude<DownloadSection, "all">) => section === "all" || section === s;
  const name = namer();
  const files: DownloadFile[] = [];
  const title = `${party.guestOfHonorName}'s ${party.occasion.toLowerCase()}`;
  const html: string[] = [];

  // --- Guest book ---------------------------------------------------------
  if (want("guestbook")) {
    const memorials = (await listMemorials(party.id)).items;
    if (memorials.length) {
      html.push(`<h2>In loving memory</h2>`);
      memorials.forEach((m, i) => {
        let media = "";
        if (m.mediaUrl && m.mediaKind) {
          const kind = m.mediaKind === "photo" ? "photo" : m.mediaKind === "video" ? "video" : "voice memo";
          const file = name("In loving memory", `${pad(i + 1)} ${m.name} - ${kind}`, extensionOf(m.mediaUrl) || (m.mediaKind === "photo" ? ".jpg" : ""));
          files.push({ name: file, url: m.mediaUrl });
          media =
            m.mediaKind === "photo"
              ? `<img loading="lazy" src="${attr(file)}" alt="" style="max-width:320px">`
              : m.mediaKind === "video"
                ? `<video controls preload="metadata" src="${attr(file)}"></video>`
                : `<audio controls preload="metadata" src="${attr(file)}"></audio>`;
        }
        html.push(
          `<article class="note">${media}<p class="from">${esc(m.name)}${m.relation ? ` <span>${esc(m.relation)}</span>` : ""}</p>${m.message ? `<p class="hand">${esc(m.message).replace(/\n/g, "<br>")}</p>` : ""}</article>`,
        );
      });
    }
    const notes = [...(await listMessages(party.id))].reverse();
    if (notes.length) {
      html.push(`<h2>Guest book <small>${notes.length}</small></h2>`);
      notes.forEach((m, i) => {
        let media = "";
        if (m.mediaUrl && m.mediaType) {
          const file = name("Guest book", `${pad(i + 1)} ${m.authorName} - ${m.mediaType === "video" ? "video" : "voice memo"}`, extensionOf(m.mediaUrl));
          files.push({ name: file, url: m.mediaUrl });
          media =
            m.mediaType === "video"
              ? `<video controls preload="metadata" src="${attr(file)}"></video>`
              : `<audio controls preload="metadata" src="${attr(file)}"></audio>`;
        }
        html.push(
          `<article class="note">${media}${m.body ? `<p class="hand">${esc(m.body).replace(/\n/g, "<br>")}</p>` : ""}<p class="from">— ${esc(m.authorName)} <span>${day(m.createdAt)}</span></p></article>`,
        );
      });
    }
  }

  // --- Photos -------------------------------------------------------------
  if (want("photos")) {
    const photos = [...(await listPhotos(party.id, { withOriginals: true }))].reverse();
    if (photos.length) {
      html.push(`<h2>Photo album <small>${photos.length}</small></h2><div class="grid photos">`);
      photos.forEach((p, i) => {
        const src = p.originalUrl ?? p.url;
        if (!src) return;
        const ext = extensionOf(src) || ".jpg";
        const file = name("Photos", `${pad(i + 1)} ${p.authorName}${p.caption ? ` - ${p.caption}` : ""}`, ext);
        files.push({ name: file, url: src });
        // iPhone HEIC originals don't show in most browsers: add the album copy for the page
        let shown = file;
        if (!BROWSER_IMAGES.has(ext) && p.url) {
          shown = name("Photos/for the page", `${pad(i + 1)} ${p.authorName}`, extensionOf(p.url) || ".jpg");
          files.push({ name: shown, url: p.url });
        }
        html.push(
          `<figure><a href="${attr(file)}"><img loading="lazy" src="${attr(shown)}" alt=""></a><figcaption>${esc(p.caption || p.authorName)}${p.caption ? `<br><span>${esc(p.authorName)}</span>` : ""}${p.hearts ? ` <span>♥ ${p.hearts}</span>` : ""}${p.story ? `<p class="story">${promptTag(p.prompt) ? `<b>${promptTag(p.prompt)}</b> ` : ""}${esc(p.story)}</p>` : ""}</figcaption></figure>`,
        );
      });
      html.push(`</div>`);
    }
  }

  // --- Designs and the gift -----------------------------------------------
  if (want("designs")) {
    const designs = await listGiftSources(party.id);
    if (designs.length) {
      html.push(`<h2>Designs for the gift <small>${designs.length}</small></h2><div class="grid designs">`);
      for (const d of designs) {
        if (!d.url) continue;
        const file = name("Designs", d.guestName, extensionOf(d.url) || ".png");
        files.push({ name: file, url: d.url });
        html.push(`<figure><a href="${attr(file)}"><img loading="lazy" src="${attr(file)}" alt=""></a><figcaption>${esc(d.guestName)}</figcaption></figure>`);
      }
      html.push(`</div>`);
    }
    const gifts = (await listSavedGifts(party.id).catch(() => [])).filter((g) => g.status === "final" && g.printUrl);
    if (gifts.length) {
      html.push(`<h2>The gift</h2><ul>`);
      for (const g of gifts) {
        const product = PRODUCTS[g.productKey as ProductKey]?.name ?? "Gift";
        const file = name("Gift", `${product} - print file`, extensionOf(g.printUrl!) || ".png");
        files.push({ name: file, url: g.printUrl! });
        html.push(`<li><a href="${attr(file)}">${esc(product)}: full-size print file</a></li>`);
      }
      html.push(`</ul>`);
    }
  }

  // --- Games, guests (full download only) ---------------------------------
  const texts: DownloadManifest["texts"] = [];
  let names: string[] = [];
  if (section === "all") {
    const people = await listThankYous(party.id);
    names = people
      .filter((p) => p.contributions.design || p.contributions.note || p.contributions.photos > 0 || p.contributions.games)
      .map((p) => p.name);

    const games: string[] = [];
    if (party.sections.games) {
      const [bp, guesses, entries] = await Promise.all([listBabyPhotos(party.id), listBabyGuesses(party.id, null), listPoolEntries(party.id, null)]);
      if (party.games.babyPhotos.revealed && guesses.length) {
        const board = scoreBabyPhotos(bp, guesses);
        games.push(
          `<h3>Guess the baby photo</h3><ol>${board.map((r) => `<li>${esc(r.name)}: ${r.correct} of ${r.total}</li>`).join("")}</ol>`,
          `<p class="soft">${bp.map((p, i) => `Photo ${i + 1}: ${esc(p.answer)}`).join(" · ")}</p>`,
        );
      }
      if (party.games.pool.actual && entries.length) {
        const a = party.games.pool.actual;
        const res = scorePool(a, entries);
        games.push(
          `<h3>Due date &amp; weight pool</h3><p>Born ${esc(day(`${a.date}T12:00:00Z`))}${a.time ? ` at ${esc(a.time)}` : ""}, ${formatWeight(a.weightOz)}${a.lengthIn != null ? `, ${a.lengthIn} in` : ""}</p>`,
          `<ol>${res.overall.map((r) => `<li>${esc(r.name)}</li>`).join("")}</ol>`,
        );
      }
    }
    const winners = party.games.raffle.winners.filter((w): w is NonNullable<typeof w> => Boolean(w));
    if (winners.length) games.push(`<h3>Raffle</h3><ul>${winners.map((w) => `<li>${esc(w.prize)}: ${esc(w.name)}</li>`).join("")}</ul>`);
    if (games.length) html.push(`<h2>Games</h2>`, ...games);

    const rows = [
      ["Name", "Email", "Design", "Guest book", "Photos", "Played games", "Gift", "Thanked"],
      ...people.map((p) => [
        p.name,
        p.email ?? "",
        p.contributions.design ? "yes" : "",
        p.contributions.note ?? "",
        p.contributions.photos || "",
        p.contributions.games ? "yes" : "",
        p.giftNote ?? "",
        p.thankedAt ? "yes" : "",
      ]),
    ];
    texts.push({ name: "Guests and gifts.csv", content: "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") });
  }

  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
body{margin:0;background:#f1f3ec;color:#253026;font:17px/1.55 Georgia,"Times New Roman",serif}
main{max-width:900px;margin:0 auto;padding:40px 18px 80px}
header{text-align:center;margin-bottom:28px}
.kicker{letter-spacing:.18em;text-transform:uppercase;font-size:12px;color:#66735f}
h1{font-weight:normal;font-size:44px;color:#56704f;margin:.2em 0}
h2{font-weight:normal;color:#56704f;border-bottom:1px solid #e2e6da;padding-bottom:6px;margin-top:44px}
h2 small{font-size:14px;color:#66735f}
.note{background:#fffdf6;border:1px solid #ece6d2;border-radius:6px;padding:18px 20px;margin:14px 0;box-shadow:0 8px 16px -14px rgba(40,30,10,.5)}
.hand{font-family:"Segoe Print","Bradley Hand","Comic Sans MS",cursive;font-size:20px;margin:0 0 8px}
.from{text-align:right;color:#56704f;margin:0}.from span{color:#8a937f;font-size:13px;margin-left:6px}
audio{width:100%;margin-bottom:8px}video{width:100%;max-height:70vh;background:#000;border-radius:6px;margin-bottom:8px}
.grid{display:grid;gap:14px}.photos{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}.designs{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
figure{margin:0;background:#fff;padding:8px 8px 4px;box-shadow:0 8px 16px -12px rgba(40,30,10,.5)}
figure img{width:100%;aspect-ratio:1;object-fit:cover;display:block}.designs img{object-fit:contain}
figcaption{font-size:14px;text-align:center;padding:6px 2px}figcaption span{color:#8a937f;font-size:12px}
.soft{color:#66735f;font-size:14px}.story{font-style:italic;font-size:15px;text-align:left;margin:6px 0 0;line-height:1.4}.story b{font-style:normal;font-size:11px;color:#56704f;font-family:Arial,sans-serif}.names{text-align:center;font-family:"Segoe Print","Bradley Hand",cursive;font-size:20px}
a{color:#56704f}
</style></head><body><main>
<header><p class="kicker">Moody Celebrations</p><h1>${esc(title)}</h1><p class="soft">Saved ${day(new Date().toISOString())}. Everything here is also in the folders next to this page.</p></header>
${html.join("\n") || `<p>Nothing here yet.</p>`}
${names.length ? `<h2>With love from</h2><p class="names">${names.map(esc).join(" · ")}</p>` : ""}
</main></body></html>`;
  texts.unshift({ name: "Open me first.html", content: page });

  const label = { all: "", photos: " - photos", guestbook: " - guest book", designs: " - designs" }[section];
  return { zipName: `${safeFileName(title)}${label}.zip`, files, texts };
}

"use client";

import { heightFrac, type Layout } from "@/lib/gift/layout";
import type { Product } from "@/lib/gift/products";
import type { Source } from "./Stage";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A design couldn't be loaded. Refresh the page and try again."));
    img.src = url;
  });
}

/** Font family the page actually uses for a class (next/font gives fonts generated names). */
function familyFor(className: string) {
  const probe = document.createElement("span");
  probe.className = className;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.textContent = "x";
  (document.querySelector("[data-theme]") ?? document.body).appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family;
}

/**
 * Draw the finished design at full print resolution. Runs in the browser:
 * the guest designs are already transparent PNGs, so this is just layering.
 */
export async function renderPrint(product: Product, layout: Layout, sources: Map<string, Source>): Promise<Blob> {
  const PW = product.widthPx;
  const PH = product.heightPx;
  const areaAspect = PH / PW;

  const canvas = document.createElement("canvas");
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't make the print file. Please try on a computer.");

  if (product.format === "jpeg" || layout.background.toLowerCase() !== "#ffffff") {
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, PW, PH);
  }
  ctx.imageSmoothingQuality = "high";

  const script = familyFor("pp-script");
  const serif = familyFor("pp-display");

  for (const el of layout.elements) {
    ctx.save();
    ctx.translate(el.x * PW, el.y * PH);
    ctx.rotate((el.rot * Math.PI) / 180);
    const w = el.w * PW;
    const h = heightFrac(el, areaAspect) * PH;
    if (el.kind === "design") {
      const src = sources.get(el.designId);
      if (src?.url) {
        const img = await loadImage(src.url);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    } else {
      const px = Math.round(el.size * PW);
      const font = `${el.font === "serif" ? "600 " : ""}${px}px ${el.font === "script" ? script : serif}`;
      try {
        await document.fonts.load(font, el.text);
      } catch {
        /* fall back to whatever is loaded */
      }
      ctx.font = font;
      ctx.fillStyle = el.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.text, 0, 0);
    }
    ctx.restore();
  }

  const type = product.format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.95));
  // Some phones can't make canvases this big and silently return nothing
  if (!blob || blob.size < 1000) {
    throw new Error("This device couldn't make a file this large. Please finish the design on a computer.");
  }
  return blob;
}

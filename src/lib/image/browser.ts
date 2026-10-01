"use client";

import { processDrawing, type ProcessResult } from "./drawing";

/** Longest side used for cleanup. Plenty for a blanket square, fast on phones. */
const PROCESS_MAX = 2000;
/** Longest side of the "original" we keep for re-processing later. */
const ORIGINAL_MAX = 4000;

export type PreparedDesign = {
  result: ProcessResult;
  /** Transparent PNG for the blanket */
  designBlob: Blob;
  designUrl: string;
  /** Lightly downsized JPEG of the untouched photo */
  originalBlob: Blob;
};

async function decode(file: Blob): Promise<ImageBitmap> {
  // imageOrientation honours the phone's EXIF rotation
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function drawScaled(bmp: ImageBitmap, max: number) {
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bmp, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), type, quality),
  );
}

/** Photo of a drawing card -> cleaned transparent design + original. */
export async function prepareFromPhoto(file: File): Promise<PreparedDesign> {
  let bmp: ImageBitmap;
  try {
    bmp = await decode(file);
  } catch {
    throw new Error("We couldn't open that photo. Try taking it again, or choose a JPEG or PNG.");
  }

  const work = drawScaled(bmp, PROCESS_MAX);
  const pixels = work.ctx.getImageData(0, 0, work.w, work.h);
  // Let the "Cleaning up…" state paint before the heavy loop
  await new Promise((r) => setTimeout(r, 30));
  const result = processDrawing({ data: pixels.data, width: work.w, height: work.h });

  const out = document.createElement("canvas");
  out.width = result.image.width;
  out.height = result.image.height;
  out.getContext("2d")!.putImageData(
    new ImageData(result.image.data, result.image.width, result.image.height),
    0,
    0,
  );
  const designBlob = await toBlob(out, "image/png");

  const orig = drawScaled(bmp, ORIGINAL_MAX);
  const originalBlob = await toBlob(orig.canvas, "image/jpeg", 0.9);
  bmp.close();

  return { result, designBlob, designUrl: URL.createObjectURL(designBlob), originalBlob };
}

/** A finger drawing (already on a transparent canvas) -> trimmed PNG. */
export async function prepareFromCanvas(canvas: HTMLCanvasElement): Promise<PreparedDesign> {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px.data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const empty = x1 < 0;
  const pad = empty ? 0 : Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  const crop = empty
    ? { x: 0, y: 0, w: width, h: height }
    : {
        x: Math.max(0, x0 - pad),
        y: Math.max(0, y0 - pad),
        w: Math.min(width, x1 + pad + 1) - Math.max(0, x0 - pad),
        h: Math.min(height, y1 + pad + 1) - Math.max(0, y0 - pad),
      };
  const trimmed = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);
  const out = document.createElement("canvas");
  out.width = crop.w;
  out.height = crop.h;
  out.getContext("2d")!.putImageData(trimmed, 0, 0);
  const designBlob = await toBlob(out, "image/png");
  return {
    result: {
      image: { data: trimmed.data, width: crop.w, height: crop.h },
      crop,
      sharpness: Number.POSITIVE_INFINITY,
      inkCoverage: empty ? 0 : 1,
      warnings: empty ? ["no-drawing"] : [],
    },
    designBlob,
    designUrl: URL.createObjectURL(designBlob),
    originalBlob: designBlob,
  };
}

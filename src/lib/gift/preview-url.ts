/** Our own address for a product preview image (see /api/preview-image). */
export function previewImageUrl(src: string) {
  if (!/^https:\/\//i.test(src)) return src;
  const b64 = typeof window === "undefined" ? Buffer.from(src).toString("base64url") : btoa(src).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `/api/preview-image?i=${b64}`;
}

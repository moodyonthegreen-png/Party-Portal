/**
 * A tiny zip writer (no compression: photos, audio and video are already
 * compressed, so "store" keeps it fast and light on memory). Works in the
 * browser and in Node. Returns the pieces of the file, ready for `new Blob(parts)`.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** Largest zip this writer can make (plain zip, without the zip64 extension). */
export const MAX_ZIP_BYTES = 0xffffffff - 1024 * 1024;

export type ZipEntry = { name: string; data: Uint8Array; date?: Date };

export class ZipWriter {
  private parts: Uint8Array[] = [];
  private central: Uint8Array[] = [];
  private offset = 0;
  private count = 0;
  private enc = new TextEncoder();

  get size() {
    return this.offset;
  }

  add({ name, data, date = new Date() }: ZipEntry) {
    const nameBytes = this.enc.encode(name);
    const crc = crc32(data);
    const { time, date: dd } = dosDateTime(date);
    if (this.offset + 30 + nameBytes.length + data.length > MAX_ZIP_BYTES) {
      throw new Error("This download is too big for one zip file. Try downloading one section at a time.");
    }

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // names are UTF-8
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, dd, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // made by
    cv.setUint16(6, 20, true); // needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, dd, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    // extra, comment, disk, internal attrs, external attrs: all 0
    cv.setUint32(42, this.offset, true);
    cen.set(nameBytes, 46);

    this.parts.push(local, data);
    this.central.push(cen);
    this.offset += local.length + data.length;
    this.count++;
  }

  /** Finish the file; returns every piece in order. */
  finish(): Uint8Array[] {
    const cdSize = this.central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, this.count, true);
    ev.setUint16(10, this.count, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, this.offset, true);
    return [...this.parts, ...this.central, end];
  }
}

/** Make a name safe for a file inside a zip (all systems). */
export function safeFileName(s: string, max = 60) {
  const clean = s
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return (clean.slice(0, max).trim() || "file").replace(/\.+$/, "");
}

/** File extension from a URL or path, e.g. ".jpg" (lowercase), or "". */
export function extensionOf(urlOrPath: string) {
  const path = urlOrPath.split("?")[0].split("#")[0];
  const m = /\.([a-z0-9]{1,5})$/i.exec(path);
  return m ? `.${m[1].toLowerCase()}` : "";
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, extensionOf, safeFileName, ZipWriter } from "../src/lib/zip.ts";

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("names are made safe", () => {
  assert.equal(safeFileName('Aunt "Mimi": hi/there?'), "Aunt Mimi hi there");
  assert.equal(safeFileName("..."), "file");
  assert.equal(extensionOf("https://x.co/a/b/photo.JPG?token=1"), ".jpg");
  assert.equal(extensionOf("https://x.co/a/b/photo"), "");
});

test("the zip opens with standard tools", () => {
  const z = new ZipWriter();
  z.add({ name: "Open me first.html", data: new TextEncoder().encode("<h1>Hi</h1>") });
  z.add({ name: "photos/001 Zoë – café.jpg", data: new Uint8Array([1, 2, 3, 4, 5]) });
  z.add({ name: "empty.txt", data: new Uint8Array() });
  const parts = z.finish();
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  const dir = mkdtempSync(join(tmpdir(), "zip-"));
  const file = join(dir, "t.zip");
  writeFileSync(file, buf);
  const out = execFileSync("python3", [
    "-c",
    "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('|'.join(z.namelist()));print(z.read('Open me first.html').decode())",
    file,
  ]).toString();
  assert.match(out, /Open me first\.html\|photos\/001 Zoë – café\.jpg\|empty\.txt/);
  assert.match(out, /<h1>Hi<\/h1>/);
});

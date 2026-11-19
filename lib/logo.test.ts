import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clientInitials, formatKb, isSafeLogo, logoBytes, MAX_LOGO_BYTES, sanitizeLogo } from "./logo";

test("initials come from the client name", () => {
  assert.equal(clientInitials("ACME Logistics"), "AL");
  assert.equal(clientInitials("acme"), "AC");
  assert.equal(clientInitials("EXAMPLE — Demo Client"), "ED");
  assert.equal(clientInitials(""), "?");
});

test("a small png data url is kept and junk is rejected", () => {
  const png = `data:image/png;base64,${btoa("png")}`;
  assert.equal(sanitizeLogo(png), png);
  assert.equal(sanitizeLogo(null), null);
  assert.equal(sanitizeLogo(""), null);
  assert.equal(isSafeLogo("https://example.com/logo.png"), false);
  assert.throws(() => sanitizeLogo("data:image/gif;base64,AAAA"), /PNG, JPG, WebP, or SVG/);
});

test("Tim's tiny Avnet files are accepted and measured in image bytes", () => {
  const png = readFileSync(new URL("../fixtures/avnet1.png", import.meta.url));
  const jpg = readFileSync(new URL("../fixtures/avnet2.jpg", import.meta.url));
  const pngUrl = `data:image/png;base64,${png.toString("base64")}`;
  const jpgUrl = `data:image/jpeg;base64,${jpg.toString("base64")}`;
  assert.equal(png.length, 2975);
  assert.equal(jpg.length, 6329);
  assert.equal(logoBytes(pngUrl), 2975);
  assert.equal(logoBytes(jpgUrl), 6329);
  assert.equal(sanitizeLogo(pngUrl), pngUrl);
  assert.equal(sanitizeLogo(jpgUrl), jpgUrl);
});

test("a logo over 300KB is rejected with the actual size and the limit", () => {
  const raw = Buffer.alloc(301 * 1024, 7);
  const url = `data:image/jpeg;base64,${raw.toString("base64")}`;
  assert.equal(isSafeLogo(url), false);
  assert.throws(() => sanitizeLogo(url), new RegExp(`${formatKb(301 * 1024)}[\\s\\S]*${formatKb(MAX_LOGO_BYTES)}`));
});

test("a 5KB and a 200KB jpeg stay under the limit", () => {
  for (const size of [5 * 1024, 200 * 1024]) {
    const url = `data:image/jpeg;base64,${Buffer.alloc(size, 3).toString("base64")}`;
    assert.equal(logoBytes(url), size);
    assert.equal(sanitizeLogo(url), url);
  }
});

test("svg logos cannot carry a script", () => {
  const plain = `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg'></svg>")}`;
  const script = `data:image/svg+xml;base64,${btoa("<svg><script>alert(1)</script></svg>")}`;
  assert.equal(isSafeLogo(plain), true);
  assert.equal(isSafeLogo(script), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { clientInitials, isSafeLogo, sanitizeLogo } from "./logo";

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

test("svg logos cannot carry a script", () => {
  const plain = `data:image/svg+xml;base64,${btoa("<svg xmlns='http://www.w3.org/2000/svg'></svg>")}`;
  const script = `data:image/svg+xml;base64,${btoa("<svg><script>alert(1)</script></svg>")}`;
  assert.equal(isSafeLogo(plain), true);
  assert.equal(isSafeLogo(script), false);
});

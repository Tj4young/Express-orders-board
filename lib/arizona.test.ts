import assert from "node:assert/strict";
import test from "node:test";

import { ARIZONA_CITIES, ARIZONA_PATH, ARIZONA_VIEW, METRO_CITIES, pinRadius } from "./arizona";

test("Arizona outline is a closed shape and the cities sit in the south-central valley", () => {
  assert.match(ARIZONA_PATH, /^M/);
  assert.match(ARIZONA_PATH, /Z$/);
  assert.ok(ARIZONA_CITIES.tempe.x < ARIZONA_CITIES.mesa.x);
  assert.ok(ARIZONA_CITIES.chandler.y > ARIZONA_CITIES.tempe.y);
  assert.ok(ARIZONA_CITIES.tempe.y > ARIZONA_VIEW.height * 0.5);
  assert.ok(ARIZONA_CITIES.tempe.x > ARIZONA_VIEW.width * 0.35);
  assert.ok(ARIZONA_CITIES.tempe.x < ARIZONA_VIEW.width * 0.7);
  assert.ok(METRO_CITIES.tempe.x < METRO_CITIES.mesa.x);
  assert.ok(METRO_CITIES.chandler.y > METRO_CITIES.mesa.y);
  assert.ok(pinRadius(0, 0) < pinRadius(4, 6));
});

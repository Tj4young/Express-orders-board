import assert from "node:assert/strict";
import test from "node:test";

import { passcodeMatches } from "./passcode";

test("passcode check requires the full value", () => {
  assert.equal(passcodeMatches("express", "express"), true);
  assert.equal(passcodeMatches("Express", "express"), false);
  assert.equal(passcodeMatches("express-extra", "express"), false);
  assert.equal(passcodeMatches("", "express"), false);
  assert.equal(passcodeMatches(null, "express"), false);
});

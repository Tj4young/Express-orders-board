import assert from "node:assert/strict";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import test from "node:test";

import { createFileRepository } from "./store";

test("file storage keeps fills across reads and parallel clicks", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "express-board-"));
  try {
    const repo = createFileRepository(path.join(dir, "board.json"));
    const created = await repo.createOrder({
      office: "tempe",
      client: "ACME",
      position: "Forklift Operator",
      payRate: "$19.00/hr",
      shift: "1st Shift",
      openings: 5,
      filled: 0,
      recruiterId: "rec_ivonne",
      dateOpened: "2026-11-01",
      notes: "",
    });
    const id = created.state.orders[0].id;
    await Promise.all(Array.from({ length: 5 }, () => repo.fill(id, "increment")));
    const fresh = createFileRepository(path.join(dir, "board.json"));
    const state = await fresh.read();
    const order = state.orders[0];
    assert.equal(order.filled, 5);
    assert.ok(order.dateFilled);
    assert.equal(state.fillEvents.length, 5);
    assert.equal(state.celebrations.length, 1);
    assert.equal(state.celebrations[0].client, "ACME");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

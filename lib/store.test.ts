import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import test from "node:test";

import { createFileRepository } from "./store";

const orderFields = {
  office: "tempe",
  client: "Avnet",
  position: "Buyer",
  payRate: "$21/hr",
  shift: "1st Shift",
  openings: 1,
  filled: 0,
  recruiterId: "rec_ivonne",
  dateOpened: "2026-11-01",
  notes: "",
};

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

test("file storage keeps a logo added on edit and drops it only when the edit clears it", async () => {
  const png = readFileSync(new URL("../fixtures/avnet1.png", import.meta.url));
  const logo = `data:image/png;base64,${png.toString("base64")}`;
  const dir = await mkdtemp(path.join(tmpdir(), "express-board-"));
  try {
    const repo = createFileRepository(path.join(dir, "board.json"));
    const created = await repo.createOrder({ ...orderFields, logo: null });
    const id = created.state.orders[0].id;

    const withLogo = await repo.updateOrder(id, { ...orderFields, logo });
    assert.equal(withLogo.state.orders[0].logo, logo);
    const reread = await createFileRepository(path.join(dir, "board.json")).read();
    assert.equal(reread.orders[0].logo, logo);

    const cleared = await repo.updateOrder(id, { ...orderFields, position: "Warehouse", logo: null });
    assert.equal(cleared.state.orders[0].logo, null);
    assert.equal(cleared.state.orders[0].position, "Warehouse");
    const after = await createFileRepository(path.join(dir, "board.json")).read();
    assert.equal(after.orders[0].logo, null);
    assert.equal(after.orders[0].position, "Warehouse");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

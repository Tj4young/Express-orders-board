import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import test from "node:test";

import { createFileRepository } from "./store";
import { formatPhoenixISODate } from "./time";

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
    assert.equal(state.celebrations.length, 5);
    assert.equal(state.celebrations.filter((item) => item.kind === "fill").length, 4);
    assert.equal(state.celebrations.find((item) => item.kind === "filled")?.client, "ACME");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reopening through file storage keeps the original fills and writes a fresh copy", async () => {
  const png = readFileSync(new URL("../fixtures/avnet1.png", import.meta.url));
  const logo = `data:image/png;base64,${png.toString("base64")}`;
  const dir = await mkdtemp(path.join(tmpdir(), "express-board-"));
  try {
    const repo = createFileRepository(path.join(dir, "board.json"));
    const created = await repo.createOrder({
      ...orderFields,
      client: "State Seal",
      position: "Machine Operator",
      openings: 2,
      notes: "Repeat client",
      logo,
    });
    const id = created.state.orders[0].id;
    await repo.fill(id, "increment", "rec_ivonne");
    await repo.fill(id, "increment", "rec_jane");
    const reopened = await repo.reopen(id);
    assert.equal(reopened.celebration, null);
    const fresh = await createFileRepository(path.join(dir, "board.json")).read();
    assert.equal(fresh.orders.length, 2);
    const original = fresh.orders.find((order) => order.id === id);
    const copy = fresh.orders.find((order) => order.id !== id);
    assert.ok(original);
    assert.ok(copy);
    assert.equal(original.filled, 2);
    assert.ok(original.dateFilled);
    assert.equal(original.logo, logo);
    assert.equal(copy.filled, 0);
    assert.equal(copy.dateFilled, null);
    assert.equal(copy.dateOpened, formatPhoenixISODate(new Date()));
    assert.equal(copy.client, "State Seal");
    assert.equal(copy.position, "Machine Operator");
    assert.equal(copy.payRate, "$21/hr");
    assert.equal(copy.shift, "1st Shift");
    assert.equal(copy.notes, "Repeat client");
    assert.equal(copy.logo, logo);
    assert.equal(copy.recruiterId, "rec_ivonne");
    assert.equal(copy.openings, 2);
    assert.equal(copy.office, "tempe");
    assert.equal(fresh.fillEvents.length, 2);
    assert.ok(fresh.fillEvents.every((event) => event.orderId === id));
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

test("file storage keeps a competitor stamp and drops it on undo", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "express-board-"));
  try {
    const repo = createFileRepository(path.join(dir, "board.json"));
    const created = await repo.createOrder({ ...orderFields, openings: 4, filled: 0 });
    const id = created.state.orders[0].id;
    await repo.fill(id, "increment", "rec_ivonne");
    const marked = await repo.competitor(id, "mark");
    assert.equal(marked.celebration, null);
    const fresh = await createFileRepository(path.join(dir, "board.json")).read();
    const order = fresh.orders.find((item) => item.id === id);
    assert.ok(order);
    assert.equal(order.filled, 1);
    assert.equal(order.dateFilled, null);
    assert.equal(typeof order.competitorFilledAt, "string");
    assert.equal(fresh.fillEvents.length, 1);
    assert.equal(fresh.celebrations.length, 1);
    assert.equal(fresh.celebrations[0]?.kind, "fill");

    const undone = await repo.competitor(id, "undo");
    assert.equal(undone.celebration, null);
    const restored = await createFileRepository(path.join(dir, "board.json")).read();
    assert.equal(restored.orders.find((item) => item.id === id)?.competitorFilledAt, null);
    assert.equal(restored.orders.find((item) => item.id === id)?.filled, 1);
    assert.equal(restored.fillEvents.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

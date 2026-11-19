import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { addExampleOrder, createInitialState, createOrder, deleteOrder, deleteRecruiter, fillOrder, normalizeState, parseOrderInput, updateOrder, updateRecruiter, type Clock } from "./board";
import { fillCelebrationTitle } from "./credit";
import { scoreBoard } from "./scoring";
import type { OrderInput } from "./types";

const NOW = new Date("2026-11-18T18:00:00.000Z");

function clock(iso = "2026-11-18T18:00:00.000Z"): Clock & { stamp: (next: string) => void } {
  let n = 0;
  let now = new Date(iso);
  return {
    get now() {
      return now;
    },
    id: () => `id-${++n}`,
    stamp(next: string) {
      now = new Date(next);
    },
  };
}

function input(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    office: "tempe",
    client: "ACME",
    position: "Forklift Operator",
    payRate: "$19.00/hr",
    shift: "1st Shift",
    openings: 2,
    filled: 0,
    recruiterId: "rec_ivonne",
    dateOpened: "2026-11-01",
    notes: "Day shift",
    logo: null,
    ...overrides,
  };
}

test("editing an order keeps the Avnet logo and a later edit can remove it", () => {
  const png = readFileSync(new URL("../fixtures/avnet1.png", import.meta.url));
  const logo = `data:image/png;base64,${png.toString("base64")}`;
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input(), timer).state;
  const id = state.orders[0].id;

  state = updateOrder(state, id, input({ client: "Avnet", logo }), timer).state;
  assert.equal(state.orders.find((order) => order.id === id)?.logo, logo);
  assert.equal(state.orders.find((order) => order.id === id)?.client, "Avnet");

  state = updateOrder(state, id, input({ client: "Avnet", position: "Buyer", logo: null }), timer).state;
  const saved = state.orders.find((order) => order.id === id);
  assert.equal(saved?.logo, null);
  assert.equal(saved?.position, "Buyer");
});

test("a new board has the desk and no orders", () => {
  const state = createInitialState(NOW);
  assert.equal(state.orders.length, 0);
  assert.deepEqual(
    state.recruiters.map((recruiter) => `${recruiter.name}:${recruiter.office}`),
    ["Ivonne:tempe", "Isabella:tempe", "Jane:tempe", "Alex:mesa", "Tim:mesa"],
  );
});

test("filling the last opening stamps the date, celebrates, and undo brings it back", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input(), timer).state;
  const id = state.orders[0].id;

  let step = fillOrder(state, id, "increment", timer);
  assert.equal(step.celebration?.kind, "fill");
  assert.equal(step.state.orders[0].filled, 1);
  assert.equal(step.state.orders[0].dateFilled, null);

  timer.stamp("2026-11-18T19:00:00.000Z");
  step = fillOrder(step.state, id, "increment", timer);
  assert.equal(step.celebration?.kind, "filled");
  assert.equal(step.celebration?.officeName, "Express Tempe");
  assert.equal(step.celebration?.position, "Forklift Operator");
  assert.equal(step.celebration?.client, "ACME");
  assert.deepEqual(step.celebration?.contributors, ["Ivonne"]);
  assert.equal(step.state.orders[0].dateFilled, "2026-11-18T19:00:00.000Z");
  assert.equal(step.state.fillEvents.length, 2);
  assert.equal(step.state.celebrations.filter((item) => item.kind === "fill").length, 1);

  const undone = fillOrder(step.state, id, "undo", timer);
  assert.equal(undone.celebration, null);
  assert.equal(undone.state.orders[0].filled, 1);
  assert.equal(undone.state.orders[0].dateFilled, null);
  assert.equal(undone.state.celebrations.length, 1);
  assert.equal(undone.state.celebrations[0]?.kind, "fill");
  assert.equal(undone.state.fillEvents.length, 1);
});

test("scores count heads and closed orders for the Phoenix week and month", () => {
  const timer = clock("2026-11-02T18:00:00.000Z");
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 1, client: "Old Win" }), timer).state;
  state = fillOrder(state, state.orders[0].id, "increment", timer).state;

  timer.stamp("2026-11-18T18:00:00.000Z");
  state = createOrder(state, input({ openings: 2, client: "ACME" }), timer).state;
  const acme = state.orders.find((order) => order.client === "ACME");
  assert.ok(acme);
  state = fillOrder(state, acme.id, "increment", timer).state;
  state = fillOrder(state, acme.id, "increment", timer).state;

  state = createOrder(
    state,
    input({ office: "mesa", recruiterId: "rec_alex", client: "Mesa Co", openings: 3, position: "Picker" }),
    timer,
  ).state;
  const mesa = state.orders.find((order) => order.client === "Mesa Co");
  assert.ok(mesa);
  state = fillOrder(state, mesa.id, "increment", timer).state;
  state = createOrder(
    state,
    input({ office: "tempe", client: "Still Open", openings: 4, dateOpened: "2026-11-01" }),
    timer,
  ).state;

  const scores = scoreBoard(state, new Date("2026-11-18T18:00:00.000Z"));
  assert.equal(scores.tempe.monthHeads, 3);
  assert.equal(scores.tempe.weekHeads, 2);
  assert.equal(scores.tempe.monthOrders, 2);
  assert.equal(scores.tempe.weekOrders, 1);
  assert.equal(scores.mesa.monthHeads, 1);
  assert.equal(scores.mesa.weekHeads, 1);
  assert.equal(scores.mesa.monthOrders, 0);
  assert.equal(scores.leader, "tempe");
  assert.equal(scores.recruiters[0].name, "Ivonne");
  assert.equal(scores.recruiters[0].monthHeads, 3);
  assert.equal(scores.recentWins[0].client, "ACME");
});

test("changing who opened an order does not move placement credit", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 1 }), timer).state;
  const id = state.orders[0].id;
  state = fillOrder(state, id, "increment", timer, "rec_ivonne").state;
  const moved = updateOrder(
    state,
    id,
    input({ openings: 1, filled: 1, office: "mesa", recruiterId: "rec_tim" }),
    timer,
  );
  assert.equal(moved.celebration, null);
  assert.equal(moved.state.orders[0].recruiterId, "rec_tim");
  assert.equal(moved.state.fillEvents[0].office, "tempe");
  assert.equal(moved.state.fillEvents[0].recruiterId, "rec_ivonne");
  const scores = scoreBoard(moved.state, NOW);
  assert.equal(scores.tempe.monthHeads, 1);
  assert.equal(scores.mesa.monthHeads, 0);
  assert.equal(scores.leader, "tempe");
});

test("placements on one order split between the people who filled them", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 4, client: "ACME" }), timer).state;
  const id = state.orders[0].id;
  state = fillOrder(state, id, "increment", timer, "rec_ivonne").state;
  state = fillOrder(state, id, "increment", timer, "rec_jane").state;
  state = fillOrder(state, id, "increment", timer, "rec_jane").state;
  const beforeUndo = scoreBoard(state, NOW);
  assert.equal(beforeUndo.recruiters.find((person) => person.name === "Ivonne")?.monthHeads, 1);
  assert.equal(beforeUndo.recruiters.find((person) => person.name === "Jane")?.monthHeads, 2);
  assert.equal(beforeUndo.tempe.monthHeads, 3);
  assert.equal(state.fillEvents.map((event) => event.recruiterId).join(","), "rec_ivonne,rec_jane,rec_jane");

  state = fillOrder(state, id, "undo", timer).state;
  const afterUndo = scoreBoard(state, NOW);
  assert.equal(state.orders[0].filled, 2);
  assert.equal(afterUndo.recruiters.find((person) => person.name === "Jane")?.monthHeads, 1);
  assert.equal(afterUndo.tempe.monthHeads, 2);

  state = fillOrder(state, id, "increment", timer, "rec_jane").state;
  state = fillOrder(state, id, "increment", timer, "rec_alex").state;
  const done = state.orders[0];
  assert.ok(done.dateFilled);
  const celebration = state.celebrations.find((item) => item.orderId === id && item.kind === "filled");
  assert.deepEqual(celebration?.contributors, ["Ivonne", "Jane", "Alex"]);
  const scores = scoreBoard(state, NOW);
  assert.equal(scores.tempe.monthHeads, 3);
  assert.equal(scores.mesa.monthHeads, 1);
  assert.equal(scores.tempe.monthOrders, 1);
});

test("older fills stay credited to the person who opened the order", () => {
  const migrated = normalizeState({
    recruiters: [
      { id: "rec_ivonne", name: "Ivonne", office: "tempe" },
      { id: "rec_jane", name: "Jane", office: "tempe" },
    ],
    orders: [
      {
        id: "order-1",
        office: "mesa",
        client: "ACME",
        position: "Welder",
        payRate: "$20/hr",
        shift: "Days",
        openings: 1,
        filled: 1,
        recruiterId: "rec_ivonne",
        dateOpened: "2026-11-01",
        dateFilled: "2026-11-02T18:00:00.000Z",
        notes: "",
        example: false,
        createdAt: "2026-11-01T18:00:00.000Z",
        updatedAt: "2026-11-02T18:00:00.000Z",
      },
    ],
    fillEvents: [
      {
        id: "fill-1",
        orderId: "order-1",
        office: "mesa",
        recruiterId: "rec_jane",
        at: "2026-11-02T18:00:00.000Z",
      },
    ],
    celebrations: [],
    updatedAt: "2026-11-02T18:00:00.000Z",
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.fillEvents[0].recruiterId, "rec_ivonne");
  assert.equal(migrated.fillEvents[0].office, "tempe");
  const again = normalizeState(migrated);
  assert.equal(again.fillEvents[0].recruiterId, "rec_ivonne");
  assert.equal(again.fillEvents[0].office, "tempe");
});

test("deleting an order removes the heads it earned", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 1 }), timer).state;
  state = fillOrder(state, state.orders[0].id, "increment", timer).state;
  state = deleteOrder(state, state.orders[0].id, timer);
  assert.equal(state.orders.length, 0);
  assert.equal(scoreBoard(state, NOW).tempe.monthHeads, 0);
});

test("only one labeled example order can be added", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = addExampleOrder(state, timer);
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].example, true);
  assert.match(state.orders[0].client, /EXAMPLE/);
  assert.throws(() => addExampleOrder(state, timer), /already on the board/);
});

test("a recruiter with orders cannot be removed", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input(), timer).state;
  assert.throws(() => deleteRecruiter(state, "rec_ivonne", timer), /still has orders/);
});

test("future open dates are rejected", () => {
  const state = createInitialState(NOW);
  assert.throws(
    () => parseOrderInput(input({ dateOpened: "2026-11-19" }), state.recruiters, NOW),
    /future/,
  );
});

test("every fill celebrates who placed it, and undo does not", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(
    state,
    input({ client: "State Seal", position: "Machine Operator", openings: 5 }),
    timer,
  ).state;
  const id = state.orders[0].id;

  const first = fillOrder(state, id, "increment", timer, "rec_ivonne");
  assert.ok(first.celebration);
  assert.equal(first.celebration.kind, "fill");
  assert.equal(first.celebration.placedBy, "Ivonne");
  assert.equal(first.celebration.filled, 1);
  assert.equal(first.celebration.openings, 5);
  assert.equal(first.celebration.added, 1);
  assert.equal(fillCelebrationTitle(first.celebration), "🎉 Ivonne placed a Machine Operator at State Seal! 1 of 5 filled");
  assert.equal(first.state.orders[0].dateFilled, null);
  assert.equal(first.state.celebrations.length, 1);
  assert.equal(first.state.fillEvents[0].recruiterId, "rec_ivonne");

  const second = fillOrder(first.state, id, "increment", timer, "rec_jane");
  assert.ok(second.celebration);
  assert.equal(fillCelebrationTitle(second.celebration), "🎉 Jane placed a Machine Operator at State Seal! 2 of 5 filled");
  assert.equal(second.state.fillEvents.map((event) => event.recruiterId).join(","), "rec_ivonne,rec_jane");
  assert.equal(second.state.celebrations.length, 2);

  const undone = fillOrder(second.state, id, "undo", timer);
  assert.equal(undone.celebration, null);
  assert.equal(undone.state.orders[0].filled, 1);
  assert.equal(undone.state.celebrations.length, 1);
  assert.equal(undone.state.celebrations[0].placedBy, "Ivonne");
  assert.equal(undone.state.fillEvents.length, 1);

  assert.equal(
    fillCelebrationTitle({
      placedBy: "Alex",
      recruiterName: "Tim",
      position: "Assembler",
      client: "ACME",
      filled: 1,
      openings: 2,
      added: 1,
    }),
    "🎉 Alex placed an Assembler at ACME! 1 of 2 filled",
  );
});

test("editing the filled count up celebrates once, and editing it down does not", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 5, position: "Machine Operator", client: "State Seal" }), timer).state;
  const id = state.orders[0].id;

  const raised = updateOrder(state, id, input({ openings: 5, filled: 2, position: "Machine Operator", client: "State Seal" }), timer);
  assert.ok(raised.celebration);
  assert.equal(raised.celebration.kind, "fill");
  assert.equal(raised.celebration.added, 2);
  assert.equal(
    fillCelebrationTitle(raised.celebration),
    "🎉 Ivonne placed 2 people as Machine Operator at State Seal! 2 of 5 filled",
  );
  assert.equal(raised.state.celebrations.length, 1);
  assert.equal(raised.state.fillEvents.length, 2);
  assert.equal(raised.state.orders[0].dateFilled, null);

  const noted = updateOrder(
    raised.state,
    id,
    input({ openings: 5, filled: 2, position: "Machine Operator", client: "State Seal", notes: "Still open" }),
    timer,
  );
  assert.equal(noted.celebration, null);
  assert.equal(noted.state.celebrations.length, 1);

  const lowered = updateOrder(
    noted.state,
    id,
    input({ openings: 5, filled: 1, position: "Machine Operator", client: "State Seal" }),
    timer,
  );
  assert.equal(lowered.celebration, null);
  assert.equal(lowered.state.orders[0].filled, 1);
  assert.equal(lowered.state.fillEvents.length, 1);
  assert.equal(lowered.state.celebrations.length, 0);

  timer.stamp("2026-11-18T20:00:00.000Z");
  const closed = updateOrder(
    lowered.state,
    id,
    input({ openings: 5, filled: 5, position: "Machine Operator", client: "State Seal" }),
    timer,
  );
  assert.equal(closed.celebration?.kind, "filled");
  assert.equal(closed.state.celebrations.filter((item) => item.kind === "fill").length, 0);
  assert.equal(closed.state.celebrations.filter((item) => item.kind === "filled").length, 1);
  assert.equal(closed.state.orders[0].dateFilled, "2026-11-18T20:00:00.000Z");
  assert.equal(closed.state.fillEvents.length, 5);
});

test("creating an order that is already full celebrates once, as an order filled", () => {
  const timer = clock();
  const created = createOrder(createInitialState(NOW), input({ openings: 2, filled: 2 }), timer);
  assert.equal(created.celebration?.kind, "filled");
  assert.equal(created.state.celebrations.length, 1);
  assert.equal(created.state.fillEvents.length, 2);
  assert.ok(created.state.orders[0].dateFilled);
});

test("normalizeState keeps current orders and older celebrations", () => {
  const legacy = {
    id: "cel-1",
    orderId: "order-1",
    office: "tempe" as const,
    officeName: "Express Tempe",
    client: "State Seal",
    position: "Machine Operator",
    recruiterName: "Ivonne",
    contributors: ["Ivonne"],
    at: "2026-11-02T18:00:00.000Z",
  };
  const stored = {
    schemaVersion: 2,
    recruiters: [{ id: "rec_ivonne", name: "Ivonne", office: "tempe" }],
    orders: [
      {
        id: "order-1",
        office: "tempe",
        client: "State Seal",
        position: "Machine Operator",
        payRate: "$20/hr",
        shift: "1st",
        openings: 5,
        filled: 5,
        recruiterId: "rec_ivonne",
        dateOpened: "2026-11-01",
        dateFilled: "2026-11-02T18:00:00.000Z",
        notes: "Keep me",
        logo: null,
        example: false,
        createdAt: "2026-11-01T18:00:00.000Z",
        updatedAt: "2026-11-02T18:00:00.000Z",
      },
    ],
    fillEvents: [
      {
        id: "fill-1",
        orderId: "order-1",
        office: "tempe",
        recruiterId: "rec_ivonne",
        at: "2026-11-02T18:00:00.000Z",
      },
    ],
    celebrations: [legacy],
    updatedAt: "2026-11-02T18:00:00.000Z",
  };
  const state = normalizeState(stored);
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.orders[0].client, "State Seal");
  assert.equal(state.orders[0].position, "Machine Operator");
  assert.equal(state.orders[0].filled, 5);
  assert.equal(state.orders[0].openings, 5);
  assert.equal(state.orders[0].notes, "Keep me");
  assert.equal(state.orders[0].logo, null);
  assert.equal(state.fillEvents[0].recruiterId, "rec_ivonne");
  assert.equal(state.fillEvents[0].office, "tempe");
  assert.equal(state.celebrations.length, 1);
  assert.equal(state.celebrations[0].id, "cel-1");
  assert.equal(state.celebrations[0].kind, undefined);
  assert.equal(state.celebrations[0].client, "State Seal");

  const withFill = normalizeState({
    ...stored,
    celebrations: [
      {
        ...legacy,
        kind: "fill",
        filled: 2,
        openings: 5,
        added: 1,
        placedBy: "Ivonne",
        placedById: "rec_ivonne",
      },
    ],
  });
  assert.equal(withFill.celebrations[0].kind, "fill");
  assert.equal(withFill.celebrations[0].filled, 2);
  assert.equal(withFill.celebrations[0].placedBy, "Ivonne");
  assert.equal(withFill.orders[0].filled, 5);
});

test("renaming a recruiter updates the name on a fill celebration", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 3 }), timer).state;
  const id = state.orders[0].id;
  state = fillOrder(state, id, "increment", timer, "rec_jane").state;
  state = updateRecruiter(state, "rec_jane", { name: "Janet", office: "tempe" }, timer);
  assert.equal(state.celebrations[0].placedBy, "Janet");
  assert.equal(state.fillEvents[0].recruiterId, "rec_jane");
});

test("a tie on the month score stays a tie", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 1, client: "A" }), timer).state;
  state = fillOrder(state, state.orders[0].id, "increment", timer).state;
  state = createOrder(state, input({ openings: 1, office: "mesa", recruiterId: "rec_alex", client: "B" }), timer).state;
  const mesa = state.orders.find((order) => order.client === "B");
  assert.ok(mesa);
  state = fillOrder(state, mesa.id, "increment", timer).state;
  assert.equal(scoreBoard(state, NOW).leader, "tie");
});

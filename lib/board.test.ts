import assert from "node:assert/strict";
import test from "node:test";

import { addExampleOrder, createInitialState, createOrder, deleteOrder, deleteRecruiter, fillOrder, normalizeState, parseOrderInput, updateOrder, type Clock } from "./board";
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
  assert.equal(step.celebration, null);
  assert.equal(step.state.orders[0].filled, 1);
  assert.equal(step.state.orders[0].dateFilled, null);

  timer.stamp("2026-11-18T19:00:00.000Z");
  step = fillOrder(step.state, id, "increment", timer);
  assert.ok(step.celebration);
  assert.equal(step.celebration?.officeName, "Express Tempe");
  assert.equal(step.celebration?.position, "Forklift Operator");
  assert.equal(step.celebration?.client, "ACME");
  assert.deepEqual(step.celebration?.contributors, ["Ivonne"]);
  assert.equal(step.state.orders[0].dateFilled, "2026-11-18T19:00:00.000Z");
  assert.equal(step.state.fillEvents.length, 2);

  const undone = fillOrder(step.state, id, "undo", timer);
  assert.equal(undone.celebration, null);
  assert.equal(undone.state.orders[0].filled, 1);
  assert.equal(undone.state.orders[0].dateFilled, null);
  assert.equal(undone.state.celebrations.length, 0);
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
  const celebration = state.celebrations.find((item) => item.orderId === id);
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

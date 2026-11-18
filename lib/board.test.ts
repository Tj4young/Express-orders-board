import assert from "node:assert/strict";
import test from "node:test";

import { addExampleOrder, createInitialState, createOrder, deleteOrder, deleteRecruiter, fillOrder, parseOrderInput, updateOrder, type Clock } from "./board";
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

test("moving an order to the other office moves its fills with it", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 1 }), timer).state;
  const id = state.orders[0].id;
  state = fillOrder(state, id, "increment", timer).state;
  const moved = updateOrder(
    state,
    id,
    input({ openings: 1, filled: 1, office: "mesa", recruiterId: "rec_tim" }),
    timer,
  );
  assert.equal(moved.celebration, null);
  assert.equal(moved.state.fillEvents[0].office, "mesa");
  assert.equal(moved.state.fillEvents[0].recruiterId, "rec_tim");
  const scores = scoreBoard(moved.state, NOW);
  assert.equal(scores.mesa.monthHeads, 1);
  assert.equal(scores.tempe.monthHeads, 0);
  assert.equal(scores.leader, "mesa");
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

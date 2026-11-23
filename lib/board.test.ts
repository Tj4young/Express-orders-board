import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { addExampleOrder, BoardError, createInitialState, createOrder, deleteOrder, deleteRecruiter, fillOrder, markCompetitorFilled, normalizeState, parseOrderInput, reopenOrder, undoCompetitorFilled, updateOrder, updateRecruiter, type Clock } from "./board";
import { fillCelebrationTitle } from "./credit";
import { savedJobs } from "./filters";
import { activeOrders, scoreBoard, wins } from "./scoring";
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

test("reopening a filled job copies the details and leaves the original credit alone", () => {
  const png = readFileSync(new URL("../fixtures/avnet1.png", import.meta.url));
  const logo = `data:image/png;base64,${png.toString("base64")}`;
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(
    state,
    input({
      client: "State Seal",
      position: "Machine Operator",
      payRate: "$22.50/hr",
      shift: "2nd Shift",
      openings: 2,
      notes: "Steel-toe required",
      logo,
      recruiterId: "rec_ivonne",
    }),
    timer,
  ).state;
  const id = state.orders[0].id;
  state = fillOrder(state, id, "increment", timer, "rec_ivonne").state;
  timer.stamp("2026-11-18T19:00:00.000Z");
  state = fillOrder(state, id, "increment", timer, "rec_jane").state;

  const before = scoreBoard(state, new Date("2026-11-18T19:00:00.000Z"));
  const beforeOrder = structuredClone(state.orders[0]);
  const beforeFills = structuredClone(state.fillEvents);
  const beforeCelebrations = state.celebrations.map((item) => item.id);

  timer.stamp("2026-11-19T05:30:00.000Z");
  const reopened = reopenOrder(state, id, timer);
  assert.equal(reopened.celebration, null);
  const original = reopened.state.orders.find((order) => order.id === id);
  const copy = reopened.state.orders.find((order) => order.id !== id);
  assert.ok(original);
  assert.ok(copy);
  assert.deepEqual(original, beforeOrder);
  assert.deepEqual(reopened.state.fillEvents, beforeFills);
  assert.deepEqual(
    reopened.state.celebrations.map((item) => item.id),
    beforeCelebrations,
  );
  assert.equal(copy.office, "tempe");
  assert.equal(copy.client, "State Seal");
  assert.equal(copy.position, "Machine Operator");
  assert.equal(copy.payRate, "$22.50/hr");
  assert.equal(copy.shift, "2nd Shift");
  assert.equal(copy.notes, "Steel-toe required");
  assert.equal(copy.logo, logo);
  assert.equal(copy.recruiterId, "rec_ivonne");
  assert.equal(copy.openings, 2);
  assert.equal(copy.filled, 0);
  assert.equal(copy.dateFilled, null);
  assert.equal(copy.dateOpened, "2026-11-18");
  assert.equal(copy.example, false);
  assert.notEqual(copy.id, id);

  const after = scoreBoard(reopened.state, new Date("2026-11-19T05:30:00.000Z"));
  assert.equal(after.tempe.monthHeads, before.tempe.monthHeads);
  assert.equal(after.tempe.monthOrders, before.tempe.monthOrders);
  assert.equal(after.mesa.monthHeads, before.mesa.monthHeads);
  assert.equal(after.recruiters.find((person) => person.name === "Jane")?.monthHeads, 1);
  assert.equal(after.recentWins.some((win) => win.orderId === id), true);
  assert.equal(after.recentWins.some((win) => win.orderId === copy.id), false);
  assert.equal(wins(reopened.state).some((order) => order.id === id), true);
  assert.equal(activeOrders(reopened.state).some((order) => order.id === copy.id), true);
  assert.equal(activeOrders(reopened.state).some((order) => order.id === id), false);

  const roundTrip = normalizeState(reopened.state);
  assert.equal(roundTrip.orders.length, 2);
  assert.equal(roundTrip.orders.find((order) => order.id === id)?.filled, 2);
  assert.equal(roundTrip.orders.find((order) => order.id === copy.id)?.filled, 0);
  assert.equal(roundTrip.fillEvents.length, 2);

  let next = reopened.state;
  next = fillOrder(next, copy.id, "increment", timer, "rec_ivonne").state;
  const partial = scoreBoard(next, new Date("2026-11-19T05:30:00.000Z"));
  assert.equal(partial.tempe.monthHeads, before.tempe.monthHeads + 1);
  assert.equal(partial.tempe.monthOrders, before.tempe.monthOrders);
  assert.equal(partial.recruiters.find((person) => person.name === "Jane")?.monthHeads, 1);
  assert.equal(next.orders.find((order) => order.id === id)?.dateFilled, beforeOrder.dateFilled);
  assert.equal(next.fillEvents.filter((event) => event.orderId === id).length, 2);
  assert.equal(next.fillEvents.filter((event) => event.orderId === copy.id).length, 1);

  next = fillOrder(next, copy.id, "increment", timer, "rec_ivonne").state;
  const closed = scoreBoard(next, new Date("2026-11-19T05:30:00.000Z"));
  assert.equal(closed.tempe.monthHeads, before.tempe.monthHeads + 2);
  assert.equal(closed.tempe.monthOrders, before.tempe.monthOrders + 1);
  assert.equal(closed.recruiters.find((person) => person.name === "Ivonne")?.monthHeads, 3);
  assert.equal(closed.recruiters.find((person) => person.name === "Jane")?.monthHeads, 1);
  assert.equal(next.orders.find((order) => order.id === id)?.filled, 2);
  assert.ok(next.orders.find((order) => order.id === copy.id)?.dateFilled);
  assert.equal(wins(next).length, 2);
});

test("reopen rejects an open order and a missing order", () => {
  const timer = clock();
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 3, filled: 1 }), timer).state;
  const id = state.orders[0].id;
  assert.throws(() => reopenOrder(state, id, timer), /still on the board/);
  assert.throws(() => reopenOrder(state, "missing", timer), (error: unknown) => {
    assert.ok(error instanceof BoardError);
    assert.equal(error.status, 404);
    return true;
  });
});

test("reopening the example does not create a second example", () => {
  const timer = clock();
  let state = addExampleOrder(createInitialState(NOW), timer);
  const id = state.orders[0].id;
  state = fillOrder(state, id, "increment", timer).state;
  state = fillOrder(state, id, "increment", timer).state;
  const next = reopenOrder(state, id, timer).state;
  assert.equal(next.orders.find((order) => order.id === id)?.example, true);
  assert.equal(next.orders.find((order) => order.id !== id)?.example, false);
  assert.equal(next.orders.filter((order) => order.example).length, 1);
  assert.throws(() => addExampleOrder(next, timer), /already on the board/);
});

test("saved jobs are per office and searchable by client or position", () => {
  const orders = [
    {
      ...input(),
      id: "open",
      client: "ACME",
      position: "Forklift",
      dateFilled: null,
      example: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
    },
    {
      ...input(),
      id: "seal",
      client: "State Seal",
      position: "Machine Operator",
      dateFilled: "2026-11-02T18:00:00.000Z",
      example: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    },
    {
      ...input(),
      id: "avnet",
      client: "Avnet",
      position: "Buyer",
      dateFilled: "2026-11-04T18:00:00.000Z",
      example: false,
      createdAt: "2026-11-03T00:00:00.000Z",
      updatedAt: "2026-11-04T00:00:00.000Z",
    },
    {
      ...input({ office: "mesa", recruiterId: "rec_alex" }),
      id: "mesa-seal",
      client: "State Seal",
      position: "Picker",
      dateFilled: "2026-11-03T18:00:00.000Z",
      example: false,
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-03T00:00:00.000Z",
    },
  ];
  assert.deepEqual(
    savedJobs(orders, "tempe", "").map((order) => order.id),
    ["avnet", "seal"],
  );
  assert.deepEqual(
    savedJobs(orders, "tempe", "seal").map((order) => order.id),
    ["seal"],
  );
  assert.deepEqual(
    savedJobs(orders, "tempe", "machine operator").map((order) => order.id),
    ["seal"],
  );
  assert.deepEqual(
    savedJobs(orders, "mesa", "state seal").map((order) => order.id),
    ["mesa-seal"],
  );
  assert.deepEqual(
    savedJobs(orders, "tempe", "acme").map((order) => order.id),
    [],
  );
});

test("normalizeState keeps current open and filled orders, and reopen does not drop them", () => {
  const stored = {
    schemaVersion: 2,
    recruiters: [
      { id: "rec_ivonne", name: "Ivonne", office: "tempe" },
      { id: "rec_alex", name: "Alex", office: "mesa" },
    ],
    orders: [
      {
        id: "still-open",
        office: "mesa",
        client: "Mesa Co",
        position: "Picker",
        payRate: "$18/hr",
        shift: "Days",
        openings: 4,
        filled: 1,
        recruiterId: "rec_alex",
        dateOpened: "2026-11-10",
        dateFilled: null,
        notes: "Keep this open order",
        logo: null,
        example: false,
        createdAt: "2026-11-10T15:00:00.000Z",
        updatedAt: "2026-11-12T15:00:00.000Z",
      },
      {
        id: "already-filled",
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
        orderId: "already-filled",
        office: "tempe",
        recruiterId: "rec_ivonne",
        at: "2026-11-02T18:00:00.000Z",
      },
    ],
    celebrations: [],
    updatedAt: "2026-11-12T15:00:00.000Z",
  };
  const loaded = normalizeState(stored);
  assert.equal(loaded.schemaVersion, 2);
  assert.equal(loaded.orders.length, 2);
  assert.equal(loaded.orders.find((order) => order.id === "still-open")?.notes, "Keep this open order");
  assert.equal(loaded.orders.find((order) => order.id === "still-open")?.competitorFilledAt, null);
  assert.equal(loaded.orders.find((order) => order.id === "already-filled")?.filled, 5);
  assert.equal(loaded.orders.find((order) => order.id === "already-filled")?.competitorFilledAt, null);
  assert.equal(loaded.fillEvents.length, 1);
  assert.equal(loaded.fillEvents[0]?.recruiterId, "rec_ivonne");

  const timer = clock("2026-11-23T16:00:00.000Z");
  const reopened = reopenOrder(loaded, "already-filled", timer);
  assert.equal(reopened.state.orders.length, 3);
  assert.equal(reopened.state.orders.find((order) => order.id === "still-open")?.filled, 1);
  assert.equal(reopened.state.orders.find((order) => order.id === "still-open")?.dateFilled, null);
  const original = reopened.state.orders.find((order) => order.id === "already-filled");
  assert.equal(original?.filled, 5);
  assert.equal(original?.dateFilled, "2026-11-02T18:00:00.000Z");
  assert.equal(reopened.state.fillEvents.filter((event) => event.orderId === "already-filled").length, 1);
  const copy = reopened.state.orders.find((order) => order.id !== "still-open" && order.id !== "already-filled");
  assert.ok(copy);
  assert.equal(copy.filled, 0);
  assert.equal(copy.dateFilled, null);
  assert.equal(copy.dateOpened, "2026-11-23");
  assert.equal(copy.client, "State Seal");
  assert.equal(copy.openings, 5);
  assert.equal(reopened.state.fillEvents.some((event) => event.orderId === copy.id), false);
  assert.equal(normalizeState(reopened.state).orders.length, 3);
});

test("a competitor pull is not a win and keeps placements already made", () => {
  const timer = clock("2026-11-18T18:00:00.000Z");
  let state = createInitialState(NOW);
  state = createOrder(state, input({ openings: 1, client: "Closed", dateOpened: "2026-11-02" }), timer).state;
  const closedId = state.orders[0].id;
  state = fillOrder(state, closedId, "increment", timer, "rec_ivonne").state;
  assert.throws(() => markCompetitorFilled(state, closedId, timer), /already filled/);

  state = createOrder(state, input({ openings: 5, client: "ACME", dateOpened: "2026-11-01" }), timer).state;
  const acme = state.orders.find((order) => order.client === "ACME");
  assert.ok(acme);
  state = fillOrder(state, acme.id, "increment", timer, "rec_ivonne").state;
  state = fillOrder(state, acme.id, "increment", timer, "rec_jane").state;

  const before = scoreBoard(state, new Date("2026-11-18T18:00:00.000Z"));
  const beforeFills = state.fillEvents.map((event) => event.id);
  const beforeCelebrations = state.celebrations.map((item) => item.id);
  assert.equal(before.tempe.monthHeads, 3);
  assert.equal(before.tempe.monthOrders, 1);
  assert.equal(before.tempe.monthFillRate, 0.5);
  assert.equal(before.recruiters.find((person) => person.name === "Jane")?.monthHeads, 1);

  timer.stamp("2026-11-18T20:00:00.000Z");
  const marked = markCompetitorFilled(state, acme.id, timer);
  assert.equal(marked.celebration, null);
  const pulled = marked.state.orders.find((order) => order.id === acme.id);
  assert.ok(pulled);
  assert.equal(pulled.competitorFilledAt, "2026-11-18T20:00:00.000Z");
  assert.equal(pulled.dateFilled, null);
  assert.equal(pulled.filled, 2);
  assert.equal(pulled.openings, 5);
  assert.deepEqual(
    marked.state.fillEvents.map((event) => event.id),
    beforeFills,
  );
  assert.deepEqual(
    marked.state.celebrations.map((item) => item.id),
    beforeCelebrations,
  );
  assert.equal(marked.state.fillEvents.filter((event) => event.orderId === acme.id).length, 2);

  const after = scoreBoard(marked.state, new Date("2026-11-18T18:00:00.000Z"));
  assert.equal(after.tempe.monthHeads, before.tempe.monthHeads);
  assert.equal(after.tempe.monthOrders, before.tempe.monthOrders);
  assert.equal(after.tempe.weekOrders, before.tempe.weekOrders);
  assert.equal(after.tempe.monthFillRate, before.tempe.monthFillRate);
  assert.equal(after.recruiters.find((person) => person.name === "Jane")?.monthHeads, 1);
  assert.equal(after.recruiters.find((person) => person.name === "Ivonne")?.monthHeads, 2);
  assert.equal(after.recentWins.some((win) => win.orderId === acme.id), false);
  assert.equal(after.recentWins.some((win) => win.client === "Closed"), true);
  assert.equal(wins(marked.state).some((order) => order.id === acme.id), false);
  assert.equal(activeOrders(marked.state).some((order) => order.id === acme.id), false);
  assert.equal(activeOrders(marked.state).some((order) => order.id === closedId), false);
  assert.deepEqual(
    savedJobs(marked.state.orders, "tempe", "").map((order) => order.client),
    ["ACME", "Closed"],
  );
  assert.deepEqual(savedJobs(marked.state.orders, "mesa", "").map((order) => order.id), []);

  const later = scoreBoard(marked.state, new Date("2026-12-02T18:00:00.000Z"));
  assert.equal(later.tempe.monthHeads, 0);
  assert.equal(later.tempe.monthOrders, 0);
  assert.equal(later.tempe.monthFillRate, null);

  assert.throws(() => fillOrder(marked.state, acme.id, "increment", timer, "rec_ivonne"), /competitor filled/);
  assert.throws(() => markCompetitorFilled(marked.state, acme.id, timer), /already marked/);
  assert.throws(
    () => updateOrder(marked.state, acme.id, input({ openings: 5, filled: 2, client: "ACME" }), timer),
    /Undo competitor filled/,
  );
  assert.throws(() => undoCompetitorFilled(state, acme.id, timer), /not marked/);

  const roundTrip = normalizeState(JSON.parse(JSON.stringify(marked.state)));
  assert.equal(roundTrip.schemaVersion, 2);
  assert.equal(roundTrip.orders.find((order) => order.id === acme.id)?.competitorFilledAt, pulled.competitorFilledAt);
  assert.equal(roundTrip.fillEvents.filter((event) => event.orderId === acme.id).length, 2);
  assert.equal(roundTrip.orders.find((order) => order.id === closedId)?.dateFilled, marked.state.orders.find((order) => order.id === closedId)?.dateFilled);

  const undone = undoCompetitorFilled(marked.state, acme.id, timer);
  assert.equal(undone.celebration, null);
  assert.equal(undone.state.orders.find((order) => order.id === acme.id)?.competitorFilledAt, null);
  assert.equal(undone.state.orders.find((order) => order.id === acme.id)?.filled, 2);
  assert.equal(activeOrders(undone.state).some((order) => order.id === acme.id), true);
  assert.equal(savedJobs(undone.state.orders, "tempe", "acme").length, 0);
  const restored = scoreBoard(undone.state, new Date("2026-11-18T18:00:00.000Z"));
  assert.equal(restored.tempe.monthHeads, before.tempe.monthHeads);
  assert.equal(restored.tempe.monthOrders, before.tempe.monthOrders);
  assert.equal(restored.tempe.monthFillRate, before.tempe.monthFillRate);

  const again = markCompetitorFilled(undone.state, acme.id, timer).state;
  timer.stamp("2026-11-19T17:00:00.000Z");
  const reopened = reopenOrder(again, acme.id, timer);
  assert.equal(reopened.celebration, null);
  const copy = reopened.state.orders.find((order) => order.id !== acme.id && order.client === "ACME");
  const original = reopened.state.orders.find((order) => order.id === acme.id);
  assert.ok(copy);
  assert.ok(original);
  assert.equal(copy.filled, 0);
  assert.equal(copy.competitorFilledAt, null);
  assert.equal(copy.dateFilled, null);
  assert.equal(copy.dateOpened, "2026-11-19");
  assert.equal(original.filled, 2);
  assert.equal(original.competitorFilledAt, "2026-11-18T20:00:00.000Z");
  assert.equal(reopened.state.fillEvents.filter((event) => event.orderId === acme.id).length, 2);
  assert.equal(reopened.state.fillEvents.some((event) => event.orderId === copy.id), false);
  assert.equal(activeOrders(reopened.state).some((order) => order.id === copy.id), true);
  assert.equal(activeOrders(reopened.state).some((order) => order.id === original.id), false);
  assert.equal(wins(reopened.state).some((order) => order.id === original.id), false);
  const reopenedScores = scoreBoard(reopened.state, new Date("2026-11-19T17:00:00.000Z"));
  assert.equal(reopenedScores.tempe.monthHeads, before.tempe.monthHeads);
  assert.equal(reopenedScores.tempe.monthOrders, before.tempe.monthOrders);
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

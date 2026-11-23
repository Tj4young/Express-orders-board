import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState, createOrder, fillOrder, markCompetitorFilled, normalizeState, undoCompetitorFilled, type Clock } from "./board";
import {
  filterLostRows,
  lostClientTotals,
  lostOfficeTotals,
  lostOrderRows,
  lostOrdersCsv,
} from "./lost";
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
    openings: 5,
    filled: 0,
    recruiterId: "rec_ivonne",
    dateOpened: "2026-11-01",
    notes: "",
    logo: null,
    ...overrides,
  };
}

test("the lost report records the pull, totals, month, and csv, and undo removes it", () => {
  const timer = clock();
  let state = createInitialState(NOW);

  timer.stamp("2026-10-20T18:00:00.000Z");
  state = createOrder(state, input({ client: "ACME, Inc", position: "Welder", openings: 2, dateOpened: "2026-10-01" }), timer).state;
  const october = state.orders.find((order) => order.position === "Welder");
  assert.ok(october);
  state = fillOrder(state, october.id, "increment", timer, "rec_ivonne").state;
  state = markCompetitorFilled(state, october.id, timer).state;

  timer.stamp("2026-11-18T18:00:00.000Z");
  state = createOrder(state, input({ client: "ACME, Inc", openings: 5, dateOpened: "2026-11-01" }), timer).state;
  const novemberAcme = state.orders.find((order) => order.position === "Forklift Operator");
  assert.ok(novemberAcme);
  state = fillOrder(state, novemberAcme.id, "increment", timer, "rec_jane").state;
  state = fillOrder(state, novemberAcme.id, "increment", timer, "rec_jane").state;
  state = markCompetitorFilled(state, novemberAcme.id, timer).state;

  state = createOrder(
    state,
    input({
      office: "mesa",
      recruiterId: "rec_alex",
      client: "State Seal",
      position: "Picker",
      openings: 3,
      dateOpened: "2026-11-10",
    }),
    timer,
  ).state;
  const mesa = state.orders.find((order) => order.client === "State Seal");
  assert.ok(mesa);
  state = markCompetitorFilled(state, mesa.id, timer).state;

  const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
  const rows = lostOrderRows(loaded);
  assert.deepEqual(
    rows.map((row) => row.client),
    ["ACME, Inc", "State Seal", "ACME, Inc"],
  );
  const acme = rows.find((row) => row.orderId === novemberAcme.id);
  assert.ok(acme);
  assert.equal(acme.markedAt, "2026-11-18T18:00:00.000Z");
  assert.equal(acme.month, "2026-11");
  assert.equal(acme.officeName, "Tempe");
  assert.equal(acme.position, "Forklift Operator");
  assert.equal(acme.openings, 5);
  assert.equal(acme.filled, 2);
  assert.equal(acme.recruiterName, "Ivonne");
  assert.equal(acme.daysOpen, 17);
  const seal = rows.find((row) => row.orderId === mesa.id);
  assert.ok(seal);
  assert.equal(seal.filled, 0);
  assert.equal(seal.openings, 3);
  assert.equal(seal.daysOpen, 8);
  assert.equal(seal.recruiterName, "Alex");
  assert.equal(rows.find((row) => row.orderId === october.id)?.daysOpen, 19);
  assert.equal(rows.find((row) => row.orderId === october.id)?.month, "2026-10");

  const november = filterLostRows(rows, "2026-11");
  assert.deepEqual(
    november.map((row) => row.orderId),
    [novemberAcme.id, mesa.id],
  );
  assert.deepEqual(lostOfficeTotals(november), [
    { office: "tempe", name: "Express Tempe", count: 1 },
    { office: "mesa", name: "Express Mesa", count: 1 },
  ]);
  assert.deepEqual(lostClientTotals(rows), [
    { client: "ACME, Inc", count: 2 },
    { client: "State Seal", count: 1 },
  ]);
  assert.deepEqual(lostOfficeTotals(rows), [
    { office: "tempe", name: "Express Tempe", count: 2 },
    { office: "mesa", name: "Express Mesa", count: 1 },
  ]);

  const csv = lostOrdersCsv(november);
  assert.equal(
    csv,
    [
      "Date marked,Office,Client,Position,Openings,Filled before pulled,Recruiter,Days open",
      '2026-11-18T18:00:00.000Z,Tempe,"ACME, Inc",Forklift Operator,5,2,Ivonne,17',
      "2026-11-18T18:00:00.000Z,Mesa,State Seal,Picker,3,0,Alex,8",
      "",
    ].join("\r\n"),
  );

  const undone = undoCompetitorFilled(loaded, novemberAcme.id, timer).state;
  assert.equal(
    lostOrderRows(undone).some((row) => row.orderId === novemberAcme.id),
    false,
  );
  assert.equal(lostOrderRows(undone).length, 2);
  assert.equal(filterLostRows(lostOrderRows(undone), "2026-11").length, 1);
});

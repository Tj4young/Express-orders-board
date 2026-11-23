import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialState,
  createOrder,
  fillOrder,
  markCompetitorFilled,
  reopenOrder,
  type Clock,
} from "./board";
import { formatPlacementWhen, recruiterPlacements, scoreBoard } from "./scoring";
import { currentPeriods, dayInPeriod, phoenixDayFromInstant } from "./time";
import type { OrderInput } from "./types";

const WHEN = new Date("2026-11-18T20:00:00.000Z");

function clock(iso: string): Clock & { stamp: (next: string) => void } {
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
    notes: "",
    logo: null,
    ...overrides,
  };
}

test("placement rows use the same month fill events as the leaderboard", () => {
  const timer = clock("2026-10-20T16:00:00.000Z");
  let state = createInitialState(WHEN);
  const logo = "data:image/png;base64,aaaa";

  state = createOrder(
    state,
    input({ client: "Old Co", position: "Packer", openings: 1, dateOpened: "2026-10-01" }),
    timer,
  ).state;
  const oldId = state.orders[0]?.id;
  assert.ok(oldId);
  state = fillOrder(state, oldId, "increment", timer, "rec_ivonne").state;

  timer.stamp("2026-11-04T15:00:00.000Z");
  state = createOrder(
    state,
    input({
      client: "State Seal",
      position: "Machine Operator",
      openings: 4,
      logo,
      dateOpened: "2026-11-01",
    }),
    timer,
  ).state;
  const seal = state.orders.find((order) => order.client === "State Seal");
  assert.ok(seal);
  state = fillOrder(state, seal.id, "increment", timer, "rec_ivonne").state;

  timer.stamp("2026-11-10T17:00:00.000Z");
  state = fillOrder(state, seal.id, "increment", timer, "rec_jane").state;

  timer.stamp("2026-11-12T17:00:00.000Z");
  state = fillOrder(state, seal.id, "increment", timer, "rec_ivonne").state;

  timer.stamp("2026-11-15T16:00:00.000Z");
  state = createOrder(
    state,
    input({ client: "ACME", position: "Forklift Operator", openings: 3, dateOpened: "2026-11-02" }),
    timer,
  ).state;
  const acme = state.orders.find((order) => order.client === "ACME");
  assert.ok(acme);
  state = fillOrder(state, acme.id, "increment", timer, "rec_ivonne").state;
  timer.stamp("2026-11-15T21:00:00.000Z");
  state = fillOrder(state, acme.id, "increment", timer, "rec_ivonne").state;

  timer.stamp("2026-11-16T16:00:00.000Z");
  state = markCompetitorFilled(state, acme.id, timer).state;
  assert.equal(state.orders.find((order) => order.id === acme.id)?.competitorFilledAt, "2026-11-16T16:00:00.000Z");

  timer.stamp("2026-11-16T18:00:00.000Z");
  state = createOrder(
    state,
    input({
      office: "mesa",
      client: "Avnet",
      position: "Buyer",
      openings: 2,
      recruiterId: "rec_alex",
      dateOpened: "2026-11-03",
    }),
    timer,
  ).state;
  const avnet = state.orders.find((order) => order.client === "Avnet");
  assert.ok(avnet);
  state = fillOrder(state, avnet.id, "increment", timer, "rec_alex").state;
  timer.stamp("2026-11-16T18:05:00.000Z");
  state = fillOrder(state, avnet.id, "increment", timer, "rec_jane").state;

  timer.stamp("2026-11-17T18:00:00.000Z");
  state = fillOrder(state, seal.id, "increment", timer, "rec_isabella").state;
  assert.ok(state.orders.find((order) => order.id === seal.id)?.dateFilled);

  timer.stamp("2026-11-18T15:00:00.000Z");
  state = reopenOrder(state, seal.id, timer).state;
  const copy = state.orders.find((order) => order.client === "State Seal" && order.id !== seal.id);
  assert.ok(copy);
  assert.equal(copy.filled, 0);
  assert.equal(copy.logo, logo);
  state = fillOrder(state, copy.id, "increment", timer, "rec_ivonne").state;

  state.fillEvents.push({
    id: "orphan",
    orderId: "missing-order",
    office: "mesa",
    recruiterId: "rec_ivonne",
    at: "2026-11-18T19:30:00.000Z",
  });

  const scores = scoreBoard(state, WHEN);
  const { month } = currentPeriods(WHEN);
  for (const person of scores.recruiters) {
    const direct = state.fillEvents.filter(
      (event) => event.recruiterId === person.recruiterId && dayInPeriod(phoenixDayFromInstant(event.at), month),
    ).length;
    const rows = recruiterPlacements(state, person.recruiterId, WHEN);
    const listed = rows.reduce((sum, row) => sum + row.count, 0);
    assert.equal(person.monthHeads, direct, person.name);
    assert.equal(listed, direct, person.name);
    for (const row of rows) {
      const onOrder = state.fillEvents.filter(
        (event) =>
          event.recruiterId === person.recruiterId &&
          event.orderId === row.orderId &&
          dayInPeriod(phoenixDayFromInstant(event.at), month),
      );
      assert.equal(row.count, onOrder.length, `${person.name} ${row.client}`);
    }
  }

  const ivonne = recruiterPlacements(state, "rec_ivonne", WHEN);
  assert.deepEqual(
    ivonne.map((row) => row.orderId),
    ["missing-order", copy.id, acme.id, seal.id],
  );
  assert.equal(ivonne.some((row) => row.orderId === oldId), false);

  const missing = ivonne[0];
  assert.ok(missing);
  assert.equal(missing.client, "Order no longer on the board");
  assert.equal(missing.office, "mesa");
  assert.equal(missing.officeName, "Mesa");
  assert.equal(missing.count, 1);
  assert.equal(formatPlacementWhen(missing), "Nov 18");

  const copyRow = ivonne.find((row) => row.orderId === copy.id);
  assert.ok(copyRow);
  assert.equal(copyRow.client, "State Seal");
  assert.equal(copyRow.position, "Machine Operator");
  assert.equal(copyRow.office, "tempe");
  assert.equal(copyRow.officeName, "Tempe");
  assert.equal(copyRow.logo, logo);
  assert.equal(copyRow.count, 1);
  assert.equal(copyRow.latestDay, "2026-11-18");
  assert.equal(formatPlacementWhen(copyRow), "Nov 18");

  const acmeRow = ivonne.find((row) => row.orderId === acme.id);
  assert.ok(acmeRow);
  assert.equal(acmeRow.count, 2);
  assert.equal(acmeRow.client, "ACME");
  assert.equal(acmeRow.position, "Forklift Operator");
  assert.equal(acmeRow.officeName, "Tempe");
  assert.equal(acmeRow.earliestDay, "2026-11-15");
  assert.equal(acmeRow.latestDay, "2026-11-15");
  assert.equal(formatPlacementWhen(acmeRow), "Nov 15");

  const sealRow = ivonne.find((row) => row.orderId === seal.id);
  assert.ok(sealRow);
  assert.equal(sealRow.count, 2);
  assert.equal(sealRow.logo, logo);
  assert.equal(sealRow.earliestDay, "2026-11-04");
  assert.equal(sealRow.latestDay, "2026-11-12");
  assert.equal(formatPlacementWhen(sealRow), "Nov 4 – Nov 12");

  const jane = recruiterPlacements(state, "rec_jane", WHEN);
  assert.deepEqual(
    jane.map((row) => `${row.client}:${row.office}:${row.count}`),
    ["Avnet:mesa:1", "State Seal:tempe:1"],
  );
  assert.equal(jane[0]?.position, "Buyer");
  assert.equal(jane[0]?.officeName, "Mesa");
  assert.equal(jane[1]?.latestDay, "2026-11-10");
  assert.equal(formatPlacementWhen(jane[1]!), "Nov 10");

  const ivonneScore = scores.recruiters.find((person) => person.name === "Ivonne");
  assert.equal(ivonneScore?.monthHeads, 6);
  assert.equal(ivonneScore?.weekHeads, 2);
  assert.equal(scores.recruiters.find((person) => person.name === "Tim")?.monthHeads, 0);
  assert.deepEqual(recruiterPlacements(state, "rec_tim", WHEN), []);
});

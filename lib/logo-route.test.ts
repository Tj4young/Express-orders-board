import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TEAM_PASSCODE = "tempe-mesa";
process.env.BOARD_FILE = path.join(mkdtempSync(path.join(tmpdir(), "orders-board-")), "board.json");

import { POST } from "../app/api/orders/route";
import { formatKb, MAX_LOGO_BYTES } from "./logo";
import { getRepository, resetRepositoryForTests } from "./store";

function dataUrl(bytes: Buffer, mime: string) {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function orderBody(client: string, logo: string) {
  return {
    office: "tempe",
    client,
    position: "Buyer",
    payRate: "$20/hr",
    shift: "1st Shift",
    openings: 1,
    filled: 0,
    recruiterId: "rec_ivonne",
    dateOpened: "2026-11-01",
    notes: "",
    logo,
  };
}

async function postOrder(client: string, logo: string) {
  resetRepositoryForTests();
  return POST(
    new Request("http://local/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "x-team-passcode": "tempe-mesa" },
      body: JSON.stringify(orderBody(client, logo)),
    }),
  );
}

test("the save route keeps both Avnet logos and reports an oversized jpeg", async () => {
  const png = dataUrl(readFileSync(new URL("../fixtures/avnet1.png", import.meta.url)), "image/png");
  const jpg = dataUrl(readFileSync(new URL("../fixtures/avnet2.jpg", import.meta.url)), "image/jpeg");
  const small = dataUrl(Buffer.alloc(5 * 1024, 4), "image/jpeg");
  const medium = dataUrl(Buffer.alloc(200 * 1024, 5), "image/jpeg");
  const huge = dataUrl(Buffer.alloc(3 * 1024 * 1024, 6), "image/jpeg");

  for (const [client, logo] of [
    ["Avnet PNG", png],
    ["Avnet JPG", jpg],
    ["Five KB", small],
    ["Two Hundred KB", medium],
  ] as const) {
    const response = await postOrder(client, logo);
    const payload = (await response.json()) as { error?: string; state?: { orders: { client: string; logo: string | null }[] } };
    assert.equal(response.status, 201, payload.error);
    const saved = payload.state?.orders.find((order) => order.client === client);
    assert.equal(saved?.logo, logo);
    resetRepositoryForTests();
    const again = await getRepository().read();
    assert.equal(again.orders.find((order) => order.client === client)?.logo, logo);
  }

  const rejected = await postOrder("Huge JPEG", huge);
  const body = (await rejected.json()) as { error?: string };
  assert.equal(rejected.status, 400);
  assert.match(body.error ?? "", new RegExp(formatKb(3 * 1024 * 1024)));
  assert.match(body.error ?? "", new RegExp(formatKb(MAX_LOGO_BYTES)));
});

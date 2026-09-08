import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import {
  bouquetPlansTable,
  buyItemsTable,
  closeMarketsTable,
  db,
  marketsTable,
  pool,
} from "@workspace/db";

const testCycles = [9001, 9002];

let server: Server;
let baseUrl: string;

type ApiResult = {
  status: number;
  body: any;
};

async function request(path: string, init?: RequestInit): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function resetTestCycles() {
  await db.transaction(async (tx) => {
    await tx.delete(buyItemsTable).where(inArray(buyItemsTable.marketCycle, testCycles));
    await tx.delete(bouquetPlansTable).where(inArray(bouquetPlansTable.marketCycle, testCycles));
    await tx.delete(closeMarketsTable).where(inArray(closeMarketsTable.marketCycle, testCycles));
    await tx.delete(marketsTable).where(inArray(marketsTable.cycle, testCycles));
  });
}

async function getContext(cycle: number): Promise<any> {
  const result = await request(`/markets/context/${cycle}`);
  assert.equal(result.status, 200);
  return result.body;
}

function patch(path: string, body: unknown) {
  return request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The API test server did not expose a TCP address.");
  }
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

beforeEach(resetTestCycles);

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

describe("market context persistence", () => {
  it("saves every planning mutation and reloads it for the requested cycle", async () => {
    const initial = await getContext(testCycles[0]);
    const otherCycleInitial = await getContext(testCycles[1]);
    const item = initial.buyItems[0];

    assert.ok(initial.buyItems.length > 0);
    assert.equal(initial.cycle, testCycles[0]);
    assert.equal(initial.bouquetPlan.marketCycle, testCycles[0]);
    assert.equal(initial.closeMarket.marketCycle, testCycles[0]);
    assert.ok(initial.buyItems.every((buyItem: any) => buyItem.marketCycle === testCycles[0]));
    assert.ok(otherCycleInitial.buyItems.every((buyItem: any) => buyItem.marketCycle === testCycles[1]));

    const buyItemUpdate = await patch(
      `/markets/context/${testCycles[0]}/buy-items/${item.id}`,
      { checked: !item.checked },
    );
    assert.equal(buyItemUpdate.status, 200);
    assert.equal(buyItemUpdate.body.marketCycle, testCycles[0]);
    assert.equal(buyItemUpdate.body.checked, !item.checked);

    const bouquetUpdate = await patch(`/markets/context/${testCycles[0]}/bouquet-plan`, {
      selectedBand: "Premium",
      count: 24,
    });
    assert.equal(bouquetUpdate.status, 200);
    assert.deepEqual(bouquetUpdate.body, {
      marketCycle: testCycles[0],
      selectedBand: "Premium",
      count: 24,
    });

    const closeUpdate = await patch(`/markets/context/${testCycles[0]}/close`, {
      counts: { Lisianthus: 4, Daisy: 2 },
      closed: true,
    });
    assert.equal(closeUpdate.status, 200);
    assert.deepEqual(closeUpdate.body, {
      marketCycle: testCycles[0],
      counts: { Lisianthus: 4, Daisy: 2 },
      closed: true,
    });

    const reloaded = await getContext(testCycles[0]);
    assert.equal(reloaded.cycle, testCycles[0]);
    assert.equal(reloaded.bouquetPlan.marketCycle, testCycles[0]);
    assert.equal(reloaded.bouquetPlan.selectedBand, "Premium");
    assert.equal(reloaded.bouquetPlan.count, 24);
    assert.equal(reloaded.closeMarket.marketCycle, testCycles[0]);
    assert.deepEqual(reloaded.closeMarket.counts, { Lisianthus: 4, Daisy: 2 });
    assert.equal(reloaded.closeMarket.closed, true);
    assert.equal(
      reloaded.buyItems.find((buyItem: any) => buyItem.id === item.id)?.checked,
      !item.checked,
    );
    assert.ok(reloaded.buyItems.every((buyItem: any) => buyItem.marketCycle === testCycles[0]));

    const otherCycleReloaded = await getContext(testCycles[1]);
    assert.deepEqual(otherCycleReloaded, otherCycleInitial);
  });

  it("rejects invalid cycles and item updates without changing saved data", async () => {
    const initial = await getContext(testCycles[0]);
    const otherCycle = await getContext(testCycles[1]);
    const item = initial.buyItems[0];
    const otherCycleItem = otherCycle.buyItems[0];

    const invalidRequests = [
      request("/markets/context/9001.5"),
      patch("/markets/context/not-an-integer/buy-items/1", { checked: false }),
      patch(`/markets/context/${testCycles[0]}/buy-items/not-an-integer`, { checked: false }),
      patch(`/markets/context/${testCycles[0]}/buy-items/${item.id}`, { checked: "false" }),
      patch(`/markets/context/${testCycles[0]}/bouquet-plan`, {
        selectedBand: "Premium",
        count: -1,
      }),
      patch(`/markets/context/${testCycles[0]}/close`, {
        counts: { Lisianthus: -1 },
        closed: true,
      }),
    ];

    const results = await Promise.all(invalidRequests);
    assert.deepEqual(results.map((result) => result.status), [400, 400, 400, 400, 400, 400]);

    const wrongCycleItem = await patch(
      `/markets/context/${testCycles[0]}/buy-items/${otherCycleItem.id}`,
      { checked: !otherCycleItem.checked },
    );
    assert.equal(wrongCycleItem.status, 404);

    const reloaded = await getContext(testCycles[0]);
    assert.deepEqual(reloaded, initial);
    assert.equal(reloaded.bouquetPlan.marketCycle, testCycles[0]);
    assert.equal(reloaded.closeMarket.marketCycle, testCycles[0]);
    assert.ok(reloaded.buyItems.every((buyItem: any) => buyItem.marketCycle === testCycles[0]));

    const otherCycleReloaded = await getContext(testCycles[1]);
    assert.deepEqual(otherCycleReloaded, otherCycle);
  });
});
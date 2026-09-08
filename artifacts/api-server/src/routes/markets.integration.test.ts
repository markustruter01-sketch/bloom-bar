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
  marketActualPurchasesTable,
  marketBuyListStatesTable,
  marketsTable,
  pool,
} from "@workspace/db";

const testCycles = [9001, 9002, 9003];

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
    await tx.delete(marketActualPurchasesTable).where(inArray(marketActualPurchasesTable.marketCycle, testCycles));
    await tx.delete(marketBuyListStatesTable).where(inArray(marketBuyListStatesTable.marketCycle, testCycles));
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
      sellThrough: [
        { flower: "Daisy", purchasedStems: 0, leftoverStems: 2, soldStems: 0, sellThroughPercent: 0 },
        { flower: "Lisianthus", purchasedStems: 0, leftoverStems: 4, soldStems: 0, sellThroughPercent: 0 },
      ],
      closed: true,
    });

    const reloaded = await getContext(testCycles[0]);
    assert.equal(reloaded.cycle, testCycles[0]);
    assert.equal(reloaded.bouquetPlan.marketCycle, testCycles[0]);
    assert.equal(reloaded.bouquetPlan.selectedBand, "Premium");
    assert.equal(reloaded.bouquetPlan.count, 24);
    assert.equal(reloaded.closeMarket.marketCycle, testCycles[0]);
    assert.deepEqual(reloaded.closeMarket.counts, { Lisianthus: 4, Daisy: 2 });
    assert.deepEqual(reloaded.closeMarket.sellThrough, closeUpdate.body.sellThrough);
    assert.equal(reloaded.closeMarket.closed, true);
    assert.equal(
      reloaded.buyItems.find((buyItem: any) => buyItem.id === item.id)?.checked,
      !item.checked,
    );
    assert.ok(reloaded.buyItems.every((buyItem: any) => buyItem.marketCycle === testCycles[0]));

    const otherCycleReloaded = await getContext(testCycles[1]);
    assert.deepEqual(otherCycleReloaded, otherCycleInitial);
  });

  it("compares actual purchases with leftovers for the same market cycle", async () => {
    const cycle = testCycles[2];
    await getContext(cycle);
    const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(lock.status, 200);
    const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          { flower: "Lisianthus", detail: "White", category: "Classic Blooms", stems: 10, unitCost: 18, source: "manual" },
          { flower: "Daisy", detail: "White", category: "Classic Blooms", stems: 4, unitCost: 12, source: "manual" },
        ],
      }),
    });
    assert.equal(saved.status, 200);

    const closeUpdate = await patch(`/markets/context/${cycle}/close`, {
      counts: { Lisianthus: 2, Daisy: 0 },
      closed: true,
    });
    assert.equal(closeUpdate.status, 200);
    assert.deepEqual(closeUpdate.body.sellThrough, [
      { flower: "Daisy", purchasedStems: 4, leftoverStems: 0, soldStems: 4, sellThroughPercent: 100 },
      { flower: "Lisianthus", purchasedStems: 10, leftoverStems: 2, soldStems: 8, sellThroughPercent: 80 },
    ]);

    const otherCycle = await getContext(testCycles[1]);
    assert.equal(otherCycle.closeMarket.marketCycle, testCycles[1]);
    assert.notDeepEqual(otherCycle.closeMarket.sellThrough, closeUpdate.body.sellThrough);
  });

  it("tracks reported flower prices and uses the latest report for future estimates", async () => {
    for (const [cycle, unitCost] of [[9001, 24], [9002, 25]] as const) {
      const context = await getContext(cycle);
      const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
      assert.equal(lock.status, 200);

      const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
        method: "PUT",
        body: JSON.stringify({
          purchases: [{
            flower: "Lisianthus",
            detail: "White · classic blooms",
            category: "Classic Blooms",
            stems: 4,
            unitCost,
            source: "manual",
          }],
        }),
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.purchases[0].unitCost, unitCost);

      const report = await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" });
      assert.equal(report.status, 200);
      assert.equal(report.body.reported, true);
      assert.equal(
        context.buyItems.find((item: any) => item.flower === "Lisianthus")?.lastPrice,
        cycle === 9001 ? 18.5 : 24,
      );
    }

    const prices = await request("/markets/flower-prices");
    assert.equal(prices.status, 200);
    const lisianthus = prices.body.find((price: any) => price.flower === "Lisianthus");
    assert.ok(lisianthus);
    assert.equal(lisianthus.latest.marketCycle, 9002);
    assert.equal(lisianthus.latest.unitCost, 25);
    assert.equal(lisianthus.previous.marketCycle, 9001);
    assert.equal(lisianthus.previous.unitCost, 24);
    assert.equal(lisianthus.change, 1);
    assert.equal(lisianthus.changePercent, (1 / 24) * 100);
    assert.deepEqual(lisianthus.history.map((point: any) => point.marketCycle), [9002, 9001]);

    const futureContext = await getContext(9003);
    assert.equal(
      futureContext.buyItems.find((item: any) => item.flower === "Lisianthus")?.lastPrice,
      25,
    );
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
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
  marketCostsTable,
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
    await tx.delete(marketCostsTable).where(inArray(marketCostsTable.marketCycle, testCycles));
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
  it("compares sell-through only across the selected completed cycles", async () => {
    for (const [cycle, stems, leftover] of [[testCycles[0], 10, 2], [testCycles[1], 8, 4]]) {
      await getContext(cycle);
      const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
      assert.equal(lock.status, 200);
      const purchases = await request(`/markets/context/${cycle}/actual-purchases`, {
        method: "PUT",
        body: JSON.stringify({
          purchases: [{
            flower: "Lisianthus",
            detail: "White · classic blooms",
            category: "Classic Blooms",
            stems,
            unitCost: 18,
            source: "manual",
          }],
        }),
      });
      assert.equal(purchases.status, 200);
      const close = await patch(`/markets/context/${cycle}/close`, {
        counts: { Lisianthus: leftover },
        closed: true,
      });
      assert.equal(close.status, 200);
    }

    const comparison = await request(`/markets/sell-through?cycles=${testCycles[0]}&cycles=${testCycles[1]}`);
    assert.equal(comparison.status, 200);
    assert.deepEqual(comparison.body.cycles.map((cycle: any) => cycle.cycle), testCycles.slice(0, 2));
    assert.deepEqual(comparison.body.flowers[0].results.map((result: any) => ({
      marketCycle: result.marketCycle,
      purchasedStems: result.purchasedStems,
      leftoverStems: result.leftoverStems,
      soldStems: result.soldStems,
      sellThroughPercent: result.sellThroughPercent,
    })), [
      { marketCycle: testCycles[0], purchasedStems: 10, leftoverStems: 2, soldStems: 8, sellThroughPercent: 80 },
      { marketCycle: testCycles[1], purchasedStems: 8, leftoverStems: 4, soldStems: 4, sellThroughPercent: 50 },
    ]);

    const incomplete = await request(`/markets/sell-through?cycles=${testCycles[0]}&cycles=${testCycles[2]}`);
    assert.equal(incomplete.status, 400);
  });

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

  it("rejects edits to a finalized close-out until it is explicitly reopened", async () => {
    await getContext(testCycles[0]);

    const finalized = await patch(`/markets/context/${testCycles[0]}/close`, {
      counts: { Lisianthus: 2 },
      closed: true,
    });
    assert.equal(finalized.status, 200);

    const unauthorizedEdit = await patch(`/markets/context/${testCycles[0]}/close`, {
      counts: { Lisianthus: 3 },
      closed: true,
    });
    assert.equal(unauthorizedEdit.status, 409);
    assert.equal(unauthorizedEdit.body.error, "This close-out is finalized. Reopen it before editing.");

    const stillFinalized = await getContext(testCycles[0]);
    assert.equal(stillFinalized.closeMarket.closed, true);
    assert.deepEqual(stillFinalized.closeMarket.counts, { Lisianthus: 2 });

    const reopened = await patch(`/markets/context/${testCycles[0]}/close`, {
      counts: { Lisianthus: 2 },
      closed: false,
      reopen: true,
    });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.closed, false);

    const editedAndFinalized = await patch(`/markets/context/${testCycles[0]}/close`, {
      counts: { Lisianthus: 3 },
      closed: true,
    });
    assert.equal(editedAndFinalized.status, 200);
    assert.deepEqual(editedAndFinalized.body.counts, { Lisianthus: 3 });
    assert.equal(editedAndFinalized.body.closed, true);
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
      const initialLisianthus = context.buyItems.find((item: any) => item.flower === "Lisianthus");
      assert.deepEqual(
        initialLisianthus?.priceSource,
        cycle === 9001
          ? { kind: "fallback", marketCycle: null, date: null }
          : { kind: "reported", marketCycle: 9001, date: "19 Sep 2371" },
      );

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
    const futureLisianthus = futureContext.buyItems.find((item: any) => item.flower === "Lisianthus");
    assert.equal(futureLisianthus?.lastPrice, 25);
    assert.deepEqual(futureLisianthus?.priceSource, {
      kind: "reported",
      marketCycle: 9002,
      date: "03 Oct 2371",
    });
  });

  it("saves editable non-flower costs and includes them in market totals", async () => {
    await getContext(testCycles[0]);
    await db.update(marketsTable).set({ revenue: 200 }).where(eq(marketsTable.cycle, testCycles[0]));

    const lock = await patch(`/markets/context/${testCycles[0]}/buy-list`, { locked: true });
    assert.equal(lock.status, 200);

    const added = await request(`/markets/context/${testCycles[0]}/costs`, {
      method: "PUT",
      body: JSON.stringify({
        costs: [
          { description: "Stall fee", amount: 30 },
          { description: "Packaging", amount: 12.5 },
        ],
      }),
    });
    assert.equal(added.status, 200);
    assert.deepEqual(added.body.costs.map((cost: any) => [cost.description, cost.amount]), [
      ["Stall fee", 30],
      ["Packaging", 12.5],
    ]);
    assert.equal(added.body.spend, 42.5);
    assert.equal(added.body.margin, 78.8);

    const editedAndRemoved = await request(`/markets/context/${testCycles[0]}/costs`, {
      method: "PUT",
      body: JSON.stringify({ costs: [{ description: "Stall fee", amount: 35 }] }),
    });
    assert.equal(editedAndRemoved.status, 200);
    assert.deepEqual(editedAndRemoved.body.costs.map((cost: any) => [cost.description, cost.amount]), [["Stall fee", 35]]);
    assert.equal(editedAndRemoved.body.spend, 35);

    const savedPurchases = await request(`/markets/context/${testCycles[0]}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [{
          flower: "Lisianthus",
          detail: "White · classic blooms",
          category: "Classic Blooms",
          stems: 4,
          unitCost: 24,
          source: "manual",
        }],
      }),
    });
    assert.equal(savedPurchases.status, 200);

    const totals = await request("/markets");
    const market = totals.body.find((entry: any) => entry.cycle === testCycles[0]);
    assert.equal(market.spend, 131);
    assert.equal(market.margin, 34.5);
    assert.equal(market.flowerSpend, 96);
    assert.deepEqual(market.costs.map((cost: any) => [cost.description, cost.amount]), [["Stall fee", 35]]);

    const reloaded = await getContext(testCycles[0]);
    assert.deepEqual(reloaded.costs.map((cost: any) => [cost.description, cost.amount]), [["Stall fee", 35]]);
    assert.equal(reloaded.spend, 131);
    assert.equal(reloaded.margin, 34.5);

    const reloadedHistory = await request("/markets");
    const reloadedMarket = reloadedHistory.body.find((entry: any) => entry.cycle === testCycles[0]);
    assert.equal(reloadedMarket.spend, reloadedMarket.flowerSpend + reloadedMarket.costs.reduce((sum: number, cost: any) => sum + cost.amount, 0));
    assert.deepEqual(reloadedMarket.costs.map((cost: any) => [cost.description, cost.amount]), [["Stall fee", 35]]);
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
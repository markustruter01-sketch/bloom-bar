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
  flowerPriceBackfillsTable,
  marketBuyListEditLogsTable,
  marketBuyListStatesTable,
  marketCostsTable,
  marketScheduleOverridesTable,
  nonFlowerBankImportsTable,
  nonFlowerPurchasesTable,
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
    await tx.delete(flowerPriceBackfillsTable);
    await tx.delete(marketBuyListEditLogsTable).where(inArray(marketBuyListEditLogsTable.marketCycle, testCycles));
    await tx.delete(marketCostsTable).where(inArray(marketCostsTable.marketCycle, testCycles));
    await tx.delete(nonFlowerBankImportsTable).where(inArray(nonFlowerBankImportsTable.marketCycle, testCycles));
    await tx.delete(nonFlowerPurchasesTable).where(inArray(nonFlowerPurchasesTable.marketCycle, testCycles));
    await tx.delete(marketBuyListStatesTable).where(inArray(marketBuyListStatesTable.marketCycle, testCycles));
    await tx.delete(buyItemsTable).where(inArray(buyItemsTable.marketCycle, testCycles));
    await tx.delete(bouquetPlansTable).where(inArray(bouquetPlansTable.marketCycle, testCycles));
    await tx.delete(closeMarketsTable).where(inArray(closeMarketsTable.marketCycle, testCycles));
    await tx.delete(marketScheduleOverridesTable).where(inArray(marketScheduleOverridesTable.marketCycle, testCycles));
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
  it("persists a skipped date and keeps downstream comparisons from treating it as real", async () => {
    const cycle = testCycles[0];
    await getContext(cycle);
    await db.update(closeMarketsTable).set({ closed: true }).where(eq(closeMarketsTable.marketCycle, cycle));

    const saved = await request(`/markets/schedule/overrides/${cycle}`, {
      method: "PUT",
      body: JSON.stringify({ status: "skipped", rescheduledDate: null }),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, {
      marketCycle: cycle,
      status: "skipped",
      rescheduledDate: null,
    });

    const listed = await request("/markets/schedule/overrides");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, [saved.body]);

    const comparison = await request(`/markets/sell-through?cycles=${cycle}`);
    assert.equal(comparison.status, 400);
    assert.match(comparison.body.error, /Skipped market cycles/);

    const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(lock.status, 200);
    const purchases = await request(`/markets/context/${cycle}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [{
          flower: "Lisianthus",
          detail: "Skipped-cycle price sample",
          category: "Classic Blooms",
          stems: 4,
          unitCost: 99,
          source: "manual",
        }],
      }),
    });
    assert.equal(purchases.status, 200);
    const report = await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" });
    assert.equal(report.status, 200);
    const prices = await request("/markets/flower-prices");
    assert.equal(prices.status, 200);
    assert.equal(prices.body.some((entry: { history: Array<{ marketCycle: number }> }) => entry.history.some((point) => point.marketCycle === cycle)), false);
  });

  it("stores multiple bunch-based supplier lines for the same flower and calculates totals", async () => {
    const cycle = testCycles[2];
    await getContext(cycle);
    const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(lock.status, 200);

    const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          {
            flower: "David Austin roses",
            detail: "Blush · premium blooms",
            category: "Statement Blooms",
            bunchSize: 10,
            bunchesPurchased: 2,
            pricePerBunch: 18,
            supplier: "Supplier A",
            source: "manual",
          },
          {
            flower: "David Austin roses",
            detail: "Blush · premium blooms",
            category: "Statement Blooms",
            bunchSize: 10,
            bunchesPurchased: 3,
            pricePerBunch: 20,
            supplier: "Supplier B",
            source: "manual",
          },
        ],
      }),
    });

    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.purchases.map((purchase: any) => ({
      flower: purchase.flower,
      bunchSize: purchase.bunchSize,
      bunchesPurchased: purchase.bunchesPurchased,
      pricePerBunch: purchase.pricePerBunch,
      supplier: purchase.supplier,
      totalStemQty: purchase.totalStemQty,
      costPerStem: purchase.costPerStem,
    })), [
      {
        flower: "David Austin roses",
        bunchSize: 10,
        bunchesPurchased: 2,
        pricePerBunch: 18,
        supplier: "Supplier A",
        totalStemQty: 20,
        costPerStem: 1.8,
      },
      {
        flower: "David Austin roses",
        bunchSize: 10,
        bunchesPurchased: 3,
        pricePerBunch: 20,
        supplier: "Supplier B",
        totalStemQty: 30,
        costPerStem: 2,
      },
    ]);

    const rows = await db
      .select({
        flower: marketActualPurchasesTable.flower,
        supplier: marketActualPurchasesTable.supplier,
        totalStemQty: marketActualPurchasesTable.totalStemQty,
        costPerStem: marketActualPurchasesTable.costPerStem,
      })
      .from(marketActualPurchasesTable)
      .where(eq(marketActualPurchasesTable.marketCycle, cycle));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => [row.flower, row.supplier, row.totalStemQty, row.costPerStem]), [
      ["David Austin roses", "Supplier A", 20, 1.8],
      ["David Austin roses", "Supplier B", 30, 2],
    ]);

    const markets = await request("/markets");
    assert.equal(markets.status, 200);
    const market = markets.body.find((candidate: any) => candidate.cycle === cycle);
    assert.equal(market.flowerSpend, 96);
  });

  it("reports the complete line-item set once and keeps a second report idempotent", async () => {
    const cycle = testCycles[2];
    await getContext(cycle);
    const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(lock.status, 200);

    const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          {
            flower: "David Austin roses",
            detail: "Blush · premium blooms",
            category: "Statement Blooms",
            bunchSize: 10,
            bunchesPurchased: 2,
            pricePerBunch: 18,
            supplier: "Supplier A",
            source: "manual",
          },
          {
            flower: "David Austin roses",
            detail: "Blush · premium blooms",
            category: "Statement Blooms",
            bunchSize: 10,
            bunchesPurchased: 3,
            pricePerBunch: 20,
            supplier: "Supplier B",
            source: "manual",
          },
        ],
      }),
    });
    assert.equal(saved.status, 200);

    const firstReport = await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" });
    const secondReport = await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" });
    assert.equal(firstReport.status, 200);
    assert.equal(secondReport.status, 200);
    assert.equal(firstReport.body.reported, true);
    assert.equal(secondReport.body.reported, true);

    const tracker = await request("/markets/flower-price-tracker");
    assert.equal(tracker.status, 200);
    assert.deepEqual(
      tracker.body.filter((report: any) => report.marketCycle === cycle).map((report: any) => ({
        marketCycle: report.marketCycle,
        date: report.date,
        venue: report.venue,
        lineItems: report.lineItems.map((item: any) => ({
          flower: item.flower,
          supplier: item.supplier,
          bunchSize: item.bunchSize,
          bunchesPurchased: item.bunchesPurchased,
          pricePerBunch: item.pricePerBunch,
          totalStemQty: item.totalStemQty,
          costPerStem: item.costPerStem,
        })),
      })),
      [{
        marketCycle: cycle,
        date: "03 Oct 2371",
        venue: "Redcliffe Markets",
        lineItems: [
          {
            flower: "David Austin roses",
            supplier: "Supplier A",
            bunchSize: 10,
            bunchesPurchased: 2,
            pricePerBunch: 18,
            totalStemQty: 20,
            costPerStem: 1.8,
          },
          {
            flower: "David Austin roses",
            supplier: "Supplier B",
            bunchSize: 10,
            bunchesPurchased: 3,
            pricePerBunch: 20,
            totalStemQty: 30,
            costPerStem: 2,
          },
        ],
      }],
    );
  });

  it("updates dashboard observations after a report and accepts historical backfills", async () => {
    const cycle = testCycles[0];
    await getContext(cycle);
    const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(lock.status, 200);
    const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [{
          flower: "Waratah",
          detail: "Red · premium native",
          category: "Premium Natives",
          bunchSize: 10,
          bunchesPurchased: 1,
          pricePerBunch: 30,
          supplier: "Current Supplier",
          source: "manual",
        }],
      }),
    });
    assert.equal(saved.status, 200);

    const beforeReport = await request("/markets/flower-price-dashboard");
    assert.equal(beforeReport.status, 200);
    assert.equal(beforeReport.body.observations.some((observation: any) => observation.flower === "Waratah"), false);

    const report = await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" });
    assert.equal(report.status, 200);
    const afterReport = await request("/markets/flower-price-dashboard");
    assert.equal(afterReport.status, 200);
    assert.deepEqual(afterReport.body.observations.filter((observation: any) => observation.flower === "Waratah").map((observation: any) => ({
      flower: observation.flower,
      category: observation.category,
      supplier: observation.supplier,
      purchaseDate: observation.purchaseDate,
      costPerStem: observation.costPerStem,
      source: observation.source,
    })), [{
      flower: "Waratah",
      category: "Premium Natives",
      supplier: "Current Supplier",
      purchaseDate: "2371-09-05",
      costPerStem: 3,
      source: "reported",
    }]);

    const backfill = await request("/markets/flower-price-backfills", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: "2025-08-10",
        flower: "Waratah",
        category: "Premium Natives",
        supplier: "Old Receipt Supplier",
        bunchSize: 10,
        bunchesPurchased: 2,
        pricePerBunch: 24,
      }),
    });
    assert.equal(backfill.status, 201);
    assert.equal(backfill.body.source, "backfill");
    assert.equal(backfill.body.totalStemQty, 20);
    assert.equal(backfill.body.costPerStem, 2.4);

    const afterBackfill = await request("/markets/flower-price-dashboard");
    assert.equal(afterBackfill.status, 200);
    assert.deepEqual(afterBackfill.body.observations.filter((observation: any) => observation.flower === "Waratah").map((observation: any) => observation.source), ["backfill", "reported"]);
  });

  it("protects the proposed list, logs unlock edits, and preserves the full purchase flow", async () => {
    const cycle = testCycles[1];
    const initial = await getContext(cycle);
    const item = initial.buyItems[0];

    const locked = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(locked.status, 200);
    assert.equal(locked.body.locked, true);

    const blockedEdit = await patch(`/markets/context/${cycle}/buy-items/${item.id}`, { checked: !item.checked });
    assert.equal(blockedEdit.status, 409);

    const unlocked = await patch(`/markets/context/${cycle}/buy-list`, { locked: false });
    assert.equal(unlocked.status, 200);
    assert.equal(unlocked.body.locked, false);
    assert.deepEqual(unlocked.body.editLog.map((entry: any) => entry.action), ["unlocked"]);

    const edited = await patch(`/markets/context/${cycle}/buy-items/${item.id}`, { checked: !item.checked });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.checked, !item.checked);

    const relocked = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
    assert.equal(relocked.status, 200);
    assert.equal(relocked.body.locked, true);
    assert.deepEqual(relocked.body.editLog.map((entry: any) => entry.action), ["unlocked", "item_updated", "relocked"]);
    assert.match(relocked.body.editLog[1].summary, new RegExp(item.flower));

    const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          {
            flower: "Dahlia",
            detail: "Coral · statement blooms",
            category: "Statement Blooms",
            bunchSize: 10,
            bunchesPurchased: 2,
            pricePerBunch: 24,
            supplier: "Supplier A",
            source: "manual",
          },
          {
            flower: "Dahlia",
            detail: "Coral · statement blooms",
            category: "Statement Blooms",
            bunchSize: 5,
            bunchesPurchased: 1,
            pricePerBunch: 14,
            supplier: "Supplier B",
            source: "manual",
          },
        ],
      }),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.purchases.map((purchase: any) => [purchase.flower, purchase.supplier, purchase.totalStemQty]), [
      ["Dahlia", "Supplier A", 20],
      ["Dahlia", "Supplier B", 5],
    ]);

    const reloaded = await getContext(cycle);
    assert.equal(reloaded.buyList.locked, true);
    assert.deepEqual(reloaded.buyList.editLog.map((entry: any) => entry.action), ["unlocked", "item_updated", "relocked"]);
    assert.deepEqual(reloaded.actualPurchases.map((purchase: any) => purchase.supplier), ["Supplier A", "Supplier B"]);
  });

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
      notes: null,
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

    const report = await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" });
    assert.equal(report.status, 200);

    const closeUpdate = await patch(`/markets/context/${cycle}/close`, {
      counts: { Lisianthus: 2, Daisy: 0 },
      closed: true,
      notes: "Rain arrived early; the foliage was tucked behind the sign.",
    });
    assert.equal(closeUpdate.status, 200);
    assert.deepEqual(closeUpdate.body.sellThrough, [
      { flower: "Daisy", purchasedStems: 4, leftoverStems: 0, soldStems: 4, sellThroughPercent: 100 },
      { flower: "Lisianthus", purchasedStems: 10, leftoverStems: 2, soldStems: 8, sellThroughPercent: 80 },
    ]);
    assert.equal(closeUpdate.body.notes, "Rain arrived early; the foliage was tucked behind the sign.");

    const tracker = await request("/markets/flower-price-tracker");
    assert.equal(tracker.status, 200);
    const trackedMarket = tracker.body.find((entry: any) => entry.marketCycle === cycle);
    assert.equal(trackedMarket.notes, closeUpdate.body.notes);
    assert.deepEqual(
      trackedMarket.lineItems.map((item: any) => [item.flower, item.sellThrough?.sellThroughPercent]),
      [["Lisianthus", 80], ["Daisy", 100]],
    );

    const dashboard = await request("/markets/flower-price-dashboard");
    assert.equal(dashboard.status, 200);
    const trackedObservation = dashboard.body.observations.find(
      (observation: any) => observation.marketCycle === cycle && observation.flower === "Lisianthus",
    );
    assert.equal(trackedObservation.purchaseDate, "2371-10-03");
    assert.equal(trackedObservation.sellThrough.sellThroughPercent, 80);
    assert.equal(trackedObservation.marketNotes, closeUpdate.body.notes);
    assert.deepEqual(
      dashboard.body.sellThroughGuidance
        .filter((entry: any) => entry.flower === "Lisianthus" || entry.flower === "Daisy")
        .map((entry: any) => [entry.flower, entry.averageSellThroughPercent, entry.guidance]),
      [["Daisy", 100, "sells well"], ["Lisianthus", 80, "sells well"]],
    );

    const otherCycle = await getContext(testCycles[1]);
    assert.equal(otherCycle.closeMarket.marketCycle, testCycles[1]);
    assert.notDeepEqual(otherCycle.closeMarket.sellThrough, closeUpdate.body.sellThrough);
  });

  it("averages finalized sell-through across market dates without using notes", async () => {
    for (const [cycle, leftover, notes] of [
      [testCycles[0], 5, "Heavy rain and a hidden stall position."],
      [testCycles[1], 0, "Bright sun and a front-row stall."],
    ] as const) {
      await getContext(cycle);
      assert.equal((await patch(`/markets/context/${cycle}/buy-list`, { locked: true })).status, 200);
      const saved = await request(`/markets/context/${cycle}/actual-purchases`, {
        method: "PUT",
        body: JSON.stringify({
          purchases: [{
            flower: "Lisianthus",
            detail: "White",
            category: "Classic Blooms",
            stems: 10,
            unitCost: 18,
            source: "manual",
          }],
        }),
      });
      assert.equal(saved.status, 200);
      assert.equal((await request(`/markets/context/${cycle}/report-purchases`, { method: "POST" })).status, 200);
      const closed = await patch(`/markets/context/${cycle}/close`, {
        counts: { Lisianthus: leftover },
        closed: true,
        notes,
      });
      assert.equal(closed.status, 200);
    }

    const dashboard = await request("/markets/flower-price-dashboard");
    assert.equal(dashboard.status, 200);
    assert.deepEqual(
      dashboard.body.sellThroughGuidance.find((entry: any) => entry.flower === "Lisianthus"),
      { flower: "Lisianthus", averageSellThroughPercent: 75, marketsTracked: 2, guidance: "sells well" },
    );
  });

  it("tracks reported flower prices and uses the latest report for future estimates", async () => {
    for (const [cycle, unitCost] of [[9001, 24], [9002, 25]] as const) {
      const context = await getContext(cycle);
      const lock = await patch(`/markets/context/${cycle}/buy-list`, { locked: true });
      assert.equal(lock.status, 200);
      const initialLisianthus = context.buyItems.find((item: any) => item.flower === "Lisianthus");
      if (cycle === 9001) {
        assert.ok(initialLisianthus?.priceSource);
        if (initialLisianthus.priceSource.kind === "reported") {
          assert.ok(initialLisianthus.priceSource.marketCycle < cycle);
        } else {
          assert.deepEqual(initialLisianthus.priceSource, { kind: "fallback", marketCycle: null, date: null });
        }
      } else {
        assert.deepEqual(initialLisianthus?.priceSource, { kind: "reported", marketCycle: 9001, date: "05 Sep 2371" });
      }

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
    assert.deepEqual(lisianthus.history.map((point: any) => point.marketCycle).filter((cycle: number) => cycle === 9002 || cycle === 9001), [9002, 9001]);

    const futureContext = await getContext(9003);
    const futureLisianthus = futureContext.buyItems.find((item: any) => item.flower === "Lisianthus");
    assert.equal(futureLisianthus?.lastPrice, 25);
    assert.deepEqual(futureLisianthus?.priceSource, {
      kind: "reported",
      marketCycle: 9002,
      date: "19 Sep 2371",
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

describe("non-flower price tracking", () => {
  it("splits one purchase across product types by quantity and percentage", async () => {
    const cycle = testCycles[2];
    const saved = await request(`/markets/non-flower-purchases/${cycle}`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          {
            category: "Packaging",
            description: "Mixed wrap pack",
            totalPrice: 40,
            quantity: 10,
            allocations: [
              { productType: "Bouquet", allocationQuantity: 3, allocationPercentage: null },
              { productType: "Bookmark", allocationQuantity: null, allocationPercentage: 25 },
            ],
          },
        ],
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.purchases[0].allocations.length, 2);
    assert.equal(saved.body.purchases[0].allocations[0].productType, "Bouquet");
    assert.equal(saved.body.purchases[0].allocations[0].allocationQuantity, 3);
    assert.equal(saved.body.purchases[0].allocations[1].productType, "Bookmark");
    assert.equal(saved.body.purchases[0].allocations[1].allocationPercentage, 25);
  });

  it("supports adding, editing, recalculating, and deleting fortnight purchase lines", async () => {
    const cycle = testCycles[2];
    const added = await request(`/markets/non-flower-purchases/${cycle}`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          { category: "Packaging", description: "Kraft wrap", totalPrice: 24, quantity: 6, productType: "Bouquet" },
          { category: "Stationery", description: "Bookmark card stock", totalPrice: 12.5, quantity: 5, productType: "Bookmark" },
        ],
      }),
    });
    assert.equal(added.status, 200);
    assert.equal(added.body.purchases.length, 2);
    assert.equal(added.body.purchases[0].costPerPiece, 4);
    assert.equal(added.body.purchases[1].costPerPiece, 2.5);
    assert.equal(new Date(added.body.endDate).getTime() - new Date(added.body.startDate).getTime(), 14 * 24 * 60 * 60 * 1000);

    const edited = await request(`/markets/non-flower-purchases/${cycle}`, {
      method: "PUT",
      body: JSON.stringify({
        purchases: [
          { category: "Packaging", description: "Kraft wrap", totalPrice: 30, quantity: 5, productType: "Bouquet" },
        ],
      }),
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.purchases.length, 1);
    assert.equal(edited.body.purchases[0].costPerPiece, 6);

    const listed = await request("/markets/non-flower-purchases");
    assert.equal(listed.status, 200);
    const listedPeriod = listed.body.find((period: any) => period.marketCycle === cycle);
    assert.equal(listedPeriod.purchases[0].description, "Kraft wrap");
    assert.equal(listedPeriod.purchases[0].costPerPiece, 6);

    const deleted = await request(`/markets/non-flower-purchases/${cycle}`, {
      method: "PUT",
      body: JSON.stringify({ purchases: [] }),
    });
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body.purchases, []);
  });

  it("imports bank lines once and reconciles editable detail rows to the source amount", async () => {
    const cycle = testCycles[2];
    const input = {
      fileName: "bloom-bar-september-export.csv",
      fileFormat: "csv",
      fileFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      lines: [
        {
          sourceLineNumber: 2,
          transactionDate: "2026-09-14",
          merchant: "Amazon Marketplace",
          description: "Amazon Marketplace",
          amount: 100,
          reference: "AMZ-100",
        },
        {
          sourceLineNumber: 3,
          transactionDate: "2026-09-15",
          merchant: "Gift Bag Co",
          description: "Kraft gift bags",
          amount: 30,
          reference: "GB-30",
        },
      ],
    };
    const imported = await request(`/markets/non-flower-purchases/${cycle}/imports`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    assert.equal(imported.status, 200);
    assert.equal(imported.body.status, "imported");
    assert.equal(imported.body.import.lines.length, 2);
    const importId = imported.body.import.id;
    const duplicate = await request(`/markets/non-flower-purchases/${cycle}/imports`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.status, "duplicate");
    assert.equal(duplicate.body.import.id, importId);

    const saved = await request(`/markets/non-flower-imports/${importId}`, {
      method: "PUT",
      body: JSON.stringify({
        lines: [
          {
            lineId: imported.body.import.lines[0].id,
            details: [
              { category: "Packaging", description: "Mailers", totalPrice: 60, quantity: 10 },
              { category: "Packaging", description: "Tissue paper", totalPrice: 40, quantity: 20 },
            ],
          },
          {
            lineId: imported.body.import.lines[1].id,
            details: [
              { category: "Packaging", description: "Gift bags", totalPrice: 20, quantity: 10 },
            ],
          },
        ],
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.lines[0].isReconciled, true);
    assert.equal(saved.body.lines[0].details[1].unitPrice, 2);
    assert.equal(saved.body.lines[1].isReconciled, false);
    assert.equal(saved.body.lines[1].reconciliationDifference, 10);

    const listed = await request("/markets/non-flower-purchases");
    assert.equal(listed.status, 200);
    const period = listed.body.find((entry: any) => entry.marketCycle === cycle);
    assert.equal(period.imports.length, 1);
    assert.equal(period.imports[0].lines.length, 2);
  });
});
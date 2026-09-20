import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  buyItemsTable,
  bouquetPlansTable,
  closeMarketsTable,
  marketActualPurchasesTable,
  marketBuyListStatesTable,
  marketCostsTable,
  marketsTable,
} from "@workspace/db";
import {
  GetMarketContextParams,
  GetMarketContextResponse,
  ListFlowerPricesResponse,
  ListMarketsResponse,
  GetSellThroughComparisonResponse,
  ReplaceMarketCostsBody,
  ReplaceMarketCostsParams,
  ReplaceMarketCostsResponse,
  ReportMarketPurchasesResponse,
  ReportMarketPurchasesParams,
  ReplaceMarketActualPurchasesBody,
  ReplaceMarketActualPurchasesParams,
  ReplaceMarketActualPurchasesResponse,
  UpdateMarketBuyListBody,
  UpdateMarketBuyListParams,
  UpdateMarketBuyListResponse,
  UpdateMarketBouquetPlanBody,
  UpdateMarketBouquetPlanParams,
  UpdateMarketBouquetPlanResponse,
  UpdateMarketBuyItemBody,
  UpdateMarketBuyItemParams,
  UpdateMarketBuyItemResponse,
  UpdateMarketCloseBody,
  UpdateMarketCloseParams,
  UpdateMarketCloseResponse,
} from "@workspace/api-zod";
import type { SellThroughRecord } from "@workspace/db";
import { formatScheduledMarketDate, getScheduledMarketDate } from "../lib/market-schedule";

const router: IRouter = Router();

const seededMarkets = [
  { cycle: 0, venue: "Redcliffe Markets", spend: 642.8, revenue: 1846, margin: 65.2 },
  { cycle: -40, venue: "Redcliffe Markets", spend: 598.4, revenue: 1712, margin: 65.0 },
  { cycle: -41, venue: "Redcliffe Markets", spend: 621.1, revenue: 1938, margin: 67.9 },
  { cycle: -42, venue: "Redcliffe Markets", spend: 560.5, revenue: 1587, margin: 64.7 },
];

const defaultBuyItems = [
  { flower: "Lisianthus", detail: "White · classic blooms", qty: 4, unit: "bunches", lastPrice: 18.5, checked: true, category: "Classic Blooms" },
  { flower: "Disbud chrysanthemum", detail: "Apricot · statement blooms", qty: 3, unit: "bunches", lastPrice: 22, checked: false, category: "Statement Blooms" },
  { flower: "Snapdragon", detail: "Blush · classic blooms", qty: 4, unit: "bunches", lastPrice: 16, checked: false, category: "Classic Blooms" },
  { flower: "Daisy", detail: "White · classic blooms", qty: 3, unit: "bunches", lastPrice: 12.5, checked: false, category: "Classic Blooms" },
  { flower: "Queen Anne’s lace", detail: "White · textural foliage", qty: 2, unit: "bunches", lastPrice: 19, checked: false, category: "Textural Foliage" },
  { flower: "Eucalyptus foliage", detail: "Silver dollar · gum", qty: 4, unit: "bunches", lastPrice: 10, checked: false, category: "Gum" },
  { flower: "Billy buttons", detail: "Golden · textural foliage", qty: 2, unit: "bunches", lastPrice: 13.5, checked: false, category: "Textural Foliage" },
];

const defaultCloseCounts = { Lisianthus: 2, Daisy: 7, Snapdragon: 3, "Eucalyptus foliage": 5 };

function calculateSellThrough(
  purchases: Array<{ flower: string; stems: number }>,
  leftovers: Record<string, number>,
): SellThroughRecord[] {
  const purchasedByFlower = new Map<string, number>();
  for (const purchase of purchases) {
    purchasedByFlower.set(purchase.flower, (purchasedByFlower.get(purchase.flower) ?? 0) + purchase.stems);
  }

  const flowers = [...new Set([...purchasedByFlower.keys(), ...Object.keys(leftovers)])].sort((a, b) => a.localeCompare(b));
  return flowers.map((flower) => {
    const purchasedStems = purchasedByFlower.get(flower) ?? 0;
    const leftoverStems = leftovers[flower] ?? 0;
    const soldStems = Math.max(0, purchasedStems - leftoverStems);
    return {
      flower,
      purchasedStems,
      leftoverStems,
      soldStems,
      sellThroughPercent: purchasedStems > 0
        ? Math.round((soldStems / purchasedStems) * 1000) / 10
        : 0,
    };
  });
}

function parseCycle(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || !/^-?\d+$/.test(value)) return null;
  return Number(value);
}

function parseCycles(raw: unknown): number[] | null {
  const values = Array.isArray(raw)
    ? raw.flatMap((value) => typeof value === "string" ? value.split(",") : [])
    : typeof raw === "string" ? raw.split(",") : undefined;
  if (!values?.length || values.some((value) => !/^-?\d+$/.test(value))) return null;
  const cycles = [...new Set(values.map(Number))];
  return cycles.length ? cycles : null;
}

async function ensureMarketContext(cycle: number) {
  await db.transaction(async (tx) => {
    for (const market of seededMarkets) {
      await tx.insert(marketsTable).values(market).onConflictDoNothing({ target: marketsTable.cycle });
    }

    await tx
      .insert(marketsTable)
      .values({ cycle, venue: "Redcliffe Markets", spend: 0, revenue: 0, margin: 0 })
      .onConflictDoNothing({ target: marketsTable.cycle });

    const existingItems = await tx
      .select({ id: buyItemsTable.id })
      .from(buyItemsTable)
      .where(eq(buyItemsTable.marketCycle, cycle));
    if (existingItems.length === 0) {
      await tx.insert(buyItemsTable).values(defaultBuyItems.map((item) => ({ ...item, marketCycle: cycle })));
    }

    const existingBuyListState = await tx
      .select({ marketCycle: marketBuyListStatesTable.marketCycle })
      .from(marketBuyListStatesTable)
      .where(eq(marketBuyListStatesTable.marketCycle, cycle));
    if (existingBuyListState.length === 0) {
      await tx.insert(marketBuyListStatesTable).values({ marketCycle: cycle, receiptCandidates: [] });
    }

    const existingPlan = await tx
      .select({ marketCycle: bouquetPlansTable.marketCycle })
      .from(bouquetPlansTable)
      .where(eq(bouquetPlansTable.marketCycle, cycle));
    if (existingPlan.length === 0) {
      await tx.insert(bouquetPlansTable).values({ marketCycle: cycle, selectedBand: "Market", count: 18 });
    }

    const existingClose = await tx
      .select({ marketCycle: closeMarketsTable.marketCycle })
      .from(closeMarketsTable)
      .where(eq(closeMarketsTable.marketCycle, cycle));
    if (existingClose.length === 0) {
      await tx.insert(closeMarketsTable).values({ marketCycle: cycle, counts: defaultCloseCounts, sellThrough: [], closed: false });
    }
  });
}

async function recalculateMarketTotals(cycle: number, tx: any, previousCostTotal?: number) {
  const [market] = await tx.select().from(marketsTable).where(eq(marketsTable.cycle, cycle));
  if (!market) return null;
  const purchases = await tx
    .select({ stems: marketActualPurchasesTable.stems, unitCost: marketActualPurchasesTable.unitCost })
    .from(marketActualPurchasesTable)
    .where(eq(marketActualPurchasesTable.marketCycle, cycle));
  const costs = await tx
    .select({ amount: marketCostsTable.amount })
    .from(marketCostsTable)
    .where(eq(marketCostsTable.marketCycle, cycle));
  const nonFlowerSpend = costs.reduce((sum: number, cost: { amount: number }) => sum + cost.amount, 0);
  const flowerSpend = purchases.reduce((sum: number, purchase: { stems: number; unitCost: number }) => sum + purchase.stems * purchase.unitCost, 0);
  const baseSpend = purchases.length > 0
    ? flowerSpend
    : market.spend - (previousCostTotal ?? nonFlowerSpend);
  const spend = Math.max(0, baseSpend) + nonFlowerSpend;
  const margin = market.revenue > 0
    ? Math.round(((market.revenue - spend) / market.revenue) * 1000) / 10
    : 0;
  const [updated] = await tx
    .update(marketsTable)
    .set({ spend, margin })
    .where(eq(marketsTable.cycle, cycle))
    .returning();
  return updated;
}

async function readMarketContext(cycle: number) {
  await ensureMarketContext(cycle);
  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.cycle, cycle));
  const buyItems = await db.select().from(buyItemsTable).where(eq(buyItemsTable.marketCycle, cycle)).orderBy(buyItemsTable.id);
  const [buyList] = await db.select().from(marketBuyListStatesTable).where(eq(marketBuyListStatesTable.marketCycle, cycle));
  const actualPurchases = await db.select().from(marketActualPurchasesTable).where(eq(marketActualPurchasesTable.marketCycle, cycle)).orderBy(marketActualPurchasesTable.id);
  const costs = await db.select().from(marketCostsTable).where(eq(marketCostsTable.marketCycle, cycle)).orderBy(marketCostsTable.id);
  const [bouquetPlan] = await db.select().from(bouquetPlansTable).where(eq(bouquetPlansTable.marketCycle, cycle));
  const [closeMarket] = await db.select().from(closeMarketsTable).where(eq(closeMarketsTable.marketCycle, cycle));
  const sellThrough = calculateSellThrough(actualPurchases, closeMarket.counts);
  const reportedPurchases = await db
    .select({
      marketCycle: marketActualPurchasesTable.marketCycle,
      flower: marketActualPurchasesTable.flower,
      unitCost: marketActualPurchasesTable.unitCost,
    })
    .from(marketActualPurchasesTable)
    .innerJoin(
      marketBuyListStatesTable,
      eq(marketBuyListStatesTable.marketCycle, marketActualPurchasesTable.marketCycle),
    )
    .where(
      and(
        eq(marketBuyListStatesTable.reported, true),
      ),
    );
  const latestReportedPrice = new Map<string, { marketCycle: number; unitCost: number }>();
  for (const purchase of reportedPurchases) {
    if (purchase.marketCycle >= cycle) continue;
    const current = latestReportedPrice.get(purchase.flower);
    if (!current || purchase.marketCycle > current.marketCycle) {
      latestReportedPrice.set(purchase.flower, purchase);
    }
  }
  const estimatedBuyItems = buyItems.map((item) => {
    const latest = latestReportedPrice.get(item.flower);
    return {
      ...item,
      ...(latest ? { lastPrice: latest.unitCost } : {}),
      priceSource: latest
        ? {
            kind: "reported" as const,
            marketCycle: latest.marketCycle,
            date: formatScheduledMarketDate(latest.marketCycle),
          }
        : {
            kind: "fallback" as const,
            marketCycle: null,
            date: null,
          },
    };
  });

  return {
    cycle,
    date: getScheduledMarketDate(cycle),
    venue: market.venue,
    spend: market.spend,
    revenue: market.revenue,
    margin: market.margin,
    buyItems: estimatedBuyItems,
    buyList,
    actualPurchases,
    costs,
    bouquetPlan,
    closeMarket: { ...closeMarket, sellThrough },
  };
}

router.get("/markets/flower-prices", async (_req, res): Promise<void> => {
  const reportedPurchases = await db
    .select({
      marketCycle: marketActualPurchasesTable.marketCycle,
      flower: marketActualPurchasesTable.flower,
      category: marketActualPurchasesTable.category,
      unitCost: marketActualPurchasesTable.unitCost,
    })
    .from(marketActualPurchasesTable)
    .innerJoin(
      marketBuyListStatesTable,
      eq(marketBuyListStatesTable.marketCycle, marketActualPurchasesTable.marketCycle),
    )
    .where(eq(marketBuyListStatesTable.reported, true));

  const byFlower = new Map<string, {
    flower: string;
    category: string;
    history: Array<{ marketCycle: number; date: string; unitCost: number }>;
  }>();
  for (const purchase of reportedPurchases) {
    const existing = byFlower.get(purchase.flower) ?? {
      flower: purchase.flower,
      category: purchase.category,
      history: [],
    };
    existing.history.push({
      marketCycle: purchase.marketCycle,
      date: formatScheduledMarketDate(purchase.marketCycle),
      unitCost: purchase.unitCost,
    });
    byFlower.set(purchase.flower, existing);
  }

  const history = Array.from(byFlower.values()).map((entry) => {
    entry.history.sort((a, b) => b.marketCycle - a.marketCycle);
    const [latest, previous] = entry.history;
    const change = previous ? latest.unitCost - previous.unitCost : null;
    const changePercent = previous && previous.unitCost !== 0
      ? (change! / previous.unitCost) * 100
      : null;
    return {
      ...entry,
      latest,
      previous: previous ?? null,
      change,
      changePercent,
    };
  }).sort((a, b) => a.flower.localeCompare(b.flower));

  res.json(ListFlowerPricesResponse.parse(history));
});

router.get("/markets", async (_req, res): Promise<void> => {
  for (const market of seededMarkets) {
    await db.insert(marketsTable).values(market).onConflictDoNothing({ target: marketsTable.cycle });
  }
  const markets = await db.select().from(marketsTable).orderBy(marketsTable.cycle);
  const closeRecords = await db
    .select({ marketCycle: closeMarketsTable.marketCycle, closed: closeMarketsTable.closed })
    .from(closeMarketsTable)
    .where(inArray(closeMarketsTable.marketCycle, markets.map((market) => market.cycle)));
  const closedByCycle = new Map(closeRecords.map((record) => [record.marketCycle, record.closed]));
  res.json(ListMarketsResponse.parse(markets.map((market) => ({
    ...market,
    date: formatScheduledMarketDate(market.cycle),
    closed: closedByCycle.get(market.cycle) ?? false,
  }))));
});

router.get("/markets/sell-through", async (req, res): Promise<void> => {
  const cycles = parseCycles(req.query.cycles);
  if (!cycles) {
    res.status(400).json({ error: "Select at least one completed market cycle." });
    return;
  }

  const [markets, closeRecords] = await Promise.all([
    db.select().from(marketsTable).where(inArray(marketsTable.cycle, cycles)),
    db.select().from(closeMarketsTable).where(inArray(closeMarketsTable.marketCycle, cycles)),
  ]);
  const closeByCycle = new Map(closeRecords.map((record) => [record.marketCycle, record]));
  if (markets.length !== cycles.length || cycles.some((cycle) => !closeByCycle.get(cycle)?.closed)) {
    res.status(400).json({ error: "Sell-through comparisons are available only for completed market cycles." });
    return;
  }

  const purchases = await db
    .select({
      marketCycle: marketActualPurchasesTable.marketCycle,
      flower: marketActualPurchasesTable.flower,
      stems: marketActualPurchasesTable.stems,
    })
    .from(marketActualPurchasesTable)
    .where(inArray(marketActualPurchasesTable.marketCycle, cycles));
  const purchasesByCycle = new Map<number, Array<{ flower: string; stems: number }>>();
  for (const purchase of purchases) {
    const cyclePurchases = purchasesByCycle.get(purchase.marketCycle) ?? [];
    cyclePurchases.push({ flower: purchase.flower, stems: purchase.stems });
    purchasesByCycle.set(purchase.marketCycle, cyclePurchases);
  }

  const sellThroughByCycle = new Map(
    cycles.map((cycle) => {
      const closeRecord = closeByCycle.get(cycle);
      return [cycle, calculateSellThrough(purchasesByCycle.get(cycle) ?? [], closeRecord?.counts ?? {})];
    }),
  );
  const flowers = [...new Set(cycles.flatMap((cycle) => sellThroughByCycle.get(cycle)?.map((record) => record.flower) ?? []))]
    .sort((a, b) => a.localeCompare(b));
  const marketByCycle = new Map(markets.map((market) => [market.cycle, market]));

  res.json(GetSellThroughComparisonResponse.parse({
    cycles: cycles.map((cycle) => {
      const market = marketByCycle.get(cycle)!;
      return {
        cycle,
        date: formatScheduledMarketDate(cycle),
        venue: market.venue,
      };
    }),
    flowers: flowers.map((flower) => ({
      flower,
      results: cycles.map((cycle) => {
        const record = sellThroughByCycle.get(cycle)?.find((candidate) => candidate.flower === flower);
        return record
          ? { marketCycle: cycle, purchasedStems: record.purchasedStems, leftoverStems: record.leftoverStems, soldStems: record.soldStems, sellThroughPercent: record.sellThroughPercent }
          : { marketCycle: cycle, purchasedStems: 0, leftoverStems: 0, soldStems: 0, sellThroughPercent: 0 };
      }),
    })),
  }));
});

router.get("/markets/context/:cycle", async (req, res): Promise<void> => {
  const params = GetMarketContextParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Market cycle must be an integer." });
    return;
  }
  res.json(GetMarketContextResponse.parse(await readMarketContext(params.data.cycle)));
});

router.patch("/markets/context/:cycle/buy-list", async (req, res): Promise<void> => {
  const params = UpdateMarketBuyListParams.safeParse(req.params);
  const body = UpdateMarketBuyListBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or lock state." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [buyList] = await db
    .update(marketBuyListStatesTable)
    .set({ locked: body.data.locked, reported: body.data.locked ? false : undefined })
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle))
    .returning();
  res.json(UpdateMarketBuyListResponse.parse(buyList));
});

router.put("/markets/context/:cycle/actual-purchases", async (req, res): Promise<void> => {
  const params = ReplaceMarketActualPurchasesParams.safeParse(req.params);
  const body = ReplaceMarketActualPurchasesBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or actual-purchase data." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [buyList] = await db
    .select()
    .from(marketBuyListStatesTable)
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle));
  if (!buyList.locked) {
    res.status(409).json({ error: "Lock the proposed buy list before entering actual purchases." });
    return;
  }
  if (body.data.purchases.some((purchase) => !purchase.flower.trim() || purchase.stems <= 0 || purchase.unitCost < 0)) {
    res.status(400).json({ error: "Each actual purchase needs a flower name, positive stem quantity, and non-negative cost." });
    return;
  }

  const saved = await db.transaction(async (tx) => {
    await tx.delete(marketActualPurchasesTable).where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle));
    if (body.data.purchases.length > 0) {
      await tx.insert(marketActualPurchasesTable).values(body.data.purchases.map((purchase) => ({
        marketCycle: params.data.cycle,
        ...purchase,
      })));
    }
    const [updatedBuyList] = await tx
      .update(marketBuyListStatesTable)
      .set({
        reported: false,
        ...(Object.prototype.hasOwnProperty.call(body.data, "receiptFileName") ? { receiptFileName: body.data.receiptFileName } : {}),
        ...(Object.prototype.hasOwnProperty.call(body.data, "receiptText") ? { receiptText: body.data.receiptText } : {}),
        ...(Object.prototype.hasOwnProperty.call(body.data, "receiptCandidates") ? { receiptCandidates: body.data.receiptCandidates } : {}),
      })
      .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle))
      .returning();
    const purchases = await tx
      .select()
      .from(marketActualPurchasesTable)
      .where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle))
      .orderBy(marketActualPurchasesTable.id);
    await recalculateMarketTotals(params.data.cycle, tx);
    return { buyList: updatedBuyList, purchases };
  });
  res.json(ReplaceMarketActualPurchasesResponse.parse(saved));
});

router.put("/markets/context/:cycle/costs", async (req, res): Promise<void> => {
  const params = ReplaceMarketCostsParams.safeParse(req.params);
  const body = ReplaceMarketCostsBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or cost data." });
    return;
  }
  if (body.data.costs.some((cost) => !cost.description.trim() || cost.amount < 0)) {
    res.status(400).json({ error: "Each market cost needs a description and a non-negative amount." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const saved = await db.transaction(async (tx) => {
    const previousCosts = await tx
      .select({ amount: marketCostsTable.amount })
      .from(marketCostsTable)
      .where(eq(marketCostsTable.marketCycle, params.data.cycle));
    const previousCostTotal = previousCosts.reduce((sum: number, cost: { amount: number }) => sum + cost.amount, 0);
    await tx.delete(marketCostsTable).where(eq(marketCostsTable.marketCycle, params.data.cycle));
    if (body.data.costs.length > 0) {
      await tx.insert(marketCostsTable).values(body.data.costs.map((cost) => ({
        marketCycle: params.data.cycle,
        description: cost.description.trim(),
        amount: cost.amount,
      })));
    }
    const market = await recalculateMarketTotals(params.data.cycle, tx, previousCostTotal);
    const costs = await tx
      .select()
      .from(marketCostsTable)
      .where(eq(marketCostsTable.marketCycle, params.data.cycle))
      .orderBy(marketCostsTable.id);
    return { costs, spend: market?.spend ?? 0, margin: market?.margin ?? 0 };
  });
  res.json(ReplaceMarketCostsResponse.parse(saved));
});

router.post("/markets/context/:cycle/report-purchases", async (req, res): Promise<void> => {
  const params = ReportMarketPurchasesParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [buyList] = await db
    .select()
    .from(marketBuyListStatesTable)
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle));
  const purchases = await db
    .select({ id: marketActualPurchasesTable.id })
    .from(marketActualPurchasesTable)
    .where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle));
  if (!buyList.locked) {
    res.status(409).json({ error: "Lock the proposed buy list before reporting actual purchases." });
    return;
  }
  if (purchases.length === 0) {
    res.status(400).json({ error: "Save at least one actual purchase before reporting." });
    return;
  }
  const [updatedBuyList] = await db
    .update(marketBuyListStatesTable)
    .set({ reported: true })
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle))
    .returning();
  res.json(ReportMarketPurchasesResponse.parse(updatedBuyList));
});

router.patch("/markets/context/:cycle/buy-items/:id", async (req, res): Promise<void> => {
  const params = UpdateMarketBuyItemParams.safeParse(req.params);
  const body = UpdateMarketBuyItemBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle) || !Number.isInteger(params.data.id)) {
    res.status(400).json({ error: "Invalid market cycle, item ID, or checked value." });
    return;
  }
  const [item] = await db
    .update(buyItemsTable)
    .set({ checked: body.data.checked })
    .where(and(eq(buyItemsTable.id, params.data.id), eq(buyItemsTable.marketCycle, params.data.cycle)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Buy-list item not found." });
    return;
  }
  const updatedContext = await readMarketContext(params.data.cycle);
  const updatedItem = updatedContext.buyItems.find((buyItem) => buyItem.id === item.id);
  res.json(UpdateMarketBuyItemResponse.parse(updatedItem));
});

router.patch("/markets/context/:cycle/bouquet-plan", async (req, res): Promise<void> => {
  const params = UpdateMarketBouquetPlanParams.safeParse(req.params);
  const body = UpdateMarketBouquetPlanBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle) || !Number.isInteger(body.data.count)) {
    res.status(400).json({ error: "Invalid market cycle or bouquet plan." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [plan] = await db
    .update(bouquetPlansTable)
    .set({ selectedBand: body.data.selectedBand, count: body.data.count })
    .where(eq(bouquetPlansTable.marketCycle, params.data.cycle))
    .returning();
  res.json(UpdateMarketBouquetPlanResponse.parse(plan));
});

router.patch("/markets/context/:cycle/close", async (req, res): Promise<void> => {
  const params = UpdateMarketCloseParams.safeParse(req.params);
  const body = UpdateMarketCloseBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or close-market data." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [existingCloseMarket] = await db
    .select()
    .from(closeMarketsTable)
    .where(eq(closeMarketsTable.marketCycle, params.data.cycle));
  if (existingCloseMarket?.closed && !body.data.reopen) {
    res.status(409).json({ error: "This close-out is finalized. Reopen it before editing." });
    return;
  }
  if (body.data.reopen && body.data.closed) {
    res.status(400).json({ error: "Reopening a finalized close-out must leave it open for editing." });
    return;
  }
  const purchases = await db
    .select({ flower: marketActualPurchasesTable.flower, stems: marketActualPurchasesTable.stems })
    .from(marketActualPurchasesTable)
    .where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle));
  const sellThrough = calculateSellThrough(purchases, body.data.counts);
  const [closeMarket] = await db
    .update(closeMarketsTable)
    .set({ counts: body.data.counts, sellThrough, closed: body.data.closed })
    .where(eq(closeMarketsTable.marketCycle, params.data.cycle))
    .returning();
  res.json(UpdateMarketCloseResponse.parse(closeMarket));
});

export default router;
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ReceiptCandidate = {
  flower: string;
  stems: number;
  unitCost: number;
  confidence: "high" | "medium" | "low";
  rawLine: string;
};

export const flowerCategories = [
  "Gum",
  "Textural Foliage",
  "Classic Blooms",
  "Statement Blooms",
  "Premium Natives",
] as const;

export type FlowerCategory = (typeof flowerCategories)[number];

const flowerCategoryConstraint = sql`"category" IN ('Gum', 'Textural Foliage', 'Classic Blooms', 'Statement Blooms', 'Premium Natives')`;

export type SellThroughRecord = {
  flower: string;
  purchasedStems: number;
  leftoverStems: number;
  soldStems: number;
  sellThroughPercent: number;
};

export const marketsTable = pgTable(
  "markets",
  {
    id: serial("id").primaryKey(),
    cycle: integer("cycle").notNull(),
    venue: text("venue").notNull(),
    spend: doublePrecision("spend").notNull().default(0),
    revenue: doublePrecision("revenue").notNull().default(0),
    margin: doublePrecision("margin").notNull().default(0),
  },
  (table) => ({ cycleUnique: unique("markets_cycle_unique").on(table.cycle) }),
);

export const marketScheduleOverridesTable = pgTable(
  "market_schedule_overrides",
  {
    marketCycle: integer("market_cycle").primaryKey(),
    status: text("status", { enum: ["skipped", "rescheduled"] }).notNull(),
    rescheduledDate: text("rescheduled_date"),
  },
  (table) => ({
    statusDatePair: check(
      "market_schedule_overrides_status_date_pair",
      sql`("status" = 'skipped' AND "rescheduled_date" IS NULL) OR ("status" = 'rescheduled' AND "rescheduled_date" IS NOT NULL)`,
    ),
  }),
);

export const buyItemsTable = pgTable("market_buy_items", {
  id: serial("id").primaryKey(),
  marketCycle: integer("market_cycle")
    .notNull()
    .references(() => marketsTable.cycle, { onDelete: "cascade" }),
  flower: text("flower").notNull(),
  detail: text("detail").notNull(),
  qty: integer("qty").notNull(),
  unit: text("unit").notNull(),
  lastPrice: doublePrecision("last_price").notNull(),
  checked: boolean("checked").notNull().default(false),
  category: text("category", { enum: flowerCategories }).notNull(),
}, (table) => ({
  categoryAllowed: check("market_buy_items_category_allowed", flowerCategoryConstraint),
}));

export const marketBuyListStatesTable = pgTable("market_buy_list_states", {
  marketCycle: integer("market_cycle")
    .primaryKey()
    .references(() => marketsTable.cycle, { onDelete: "cascade" }),
  locked: boolean("locked").notNull().default(false),
  reported: boolean("reported").notNull().default(false),
  receiptFileName: text("receipt_file_name"),
  receiptText: text("receipt_text"),
  receiptCandidates: jsonb("receipt_candidates").$type<ReceiptCandidate[]>().notNull().default([]),
});

export const marketActualPurchasesTable = pgTable(
  "market_actual_purchases",
  {
    id: serial("id").primaryKey(),
    marketCycle: integer("market_cycle")
      .notNull()
      .references(() => marketsTable.cycle, { onDelete: "cascade" }),
    flower: text("flower").notNull(),
    detail: text("detail").notNull(),
    category: text("category", { enum: flowerCategories }).notNull(),
    bunchSize: integer("bunch_size").notNull(),
    bunchesPurchased: integer("bunches_purchased").notNull(),
    pricePerBunch: doublePrecision("price_per_bunch").notNull(),
    supplier: text("supplier"),
    totalStemQty: integer("total_stem_qty").generatedAlwaysAs(
      sql`"bunch_size" * "bunches_purchased"`,
    ),
    costPerStem: doublePrecision("cost_per_stem").generatedAlwaysAs(
      sql`CASE WHEN "bunch_size" > 0 THEN "price_per_bunch" / "bunch_size" ELSE 0 END`,
    ),
    source: text("source").notNull().default("manual"),
  },
  (table) => ({
    marketFlowerIndex: index("market_actual_purchases_cycle_flower_idx").on(table.marketCycle, table.flower),
    categoryAllowed: check("market_actual_purchases_category_allowed", flowerCategoryConstraint),
    bunchSizePositive: check("market_actual_purchases_bunch_size_positive", sql`"bunch_size" > 0`),
    bunchesPurchasedPositive: check("market_actual_purchases_bunches_positive", sql`"bunches_purchased" > 0`),
    pricePerBunchNonNegative: check("market_actual_purchases_price_per_bunch_non_negative", sql`"price_per_bunch" >= 0`),
  }),
);

export const marketCostsTable = pgTable("market_costs", {
  id: serial("id").primaryKey(),
  marketCycle: integer("market_cycle")
    .notNull()
    .references(() => marketsTable.cycle, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
});

export const bouquetPlansTable = pgTable("market_bouquet_plans", {
  marketCycle: integer("market_cycle")
    .primaryKey()
    .references(() => marketsTable.cycle, { onDelete: "cascade" }),
  selectedBand: text("selected_band").notNull(),
  count: integer("count").notNull().default(0),
});

export const closeMarketsTable = pgTable("market_close_records", {
  marketCycle: integer("market_cycle")
    .primaryKey()
    .references(() => marketsTable.cycle, { onDelete: "cascade" }),
  counts: jsonb("counts").$type<Record<string, number>>().notNull().default({}),
  sellThrough: jsonb("sell_through").$type<SellThroughRecord[]>().notNull().default([]),
  closed: boolean("closed").notNull().default(false),
});

export const insertMarketSchema = createInsertSchema(marketsTable).omit({ id: true });
export const insertMarketScheduleOverrideSchema = createInsertSchema(marketScheduleOverridesTable);
export const insertBuyItemSchema = createInsertSchema(buyItemsTable).omit({ id: true });
export const insertMarketBuyListStateSchema = createInsertSchema(marketBuyListStatesTable);
export const insertMarketActualPurchaseSchema = createInsertSchema(marketActualPurchasesTable).omit({ id: true });
export const insertMarketCostSchema = createInsertSchema(marketCostsTable).omit({ id: true });
export const insertBouquetPlanSchema = createInsertSchema(bouquetPlansTable);
export const insertCloseMarketSchema = createInsertSchema(closeMarketsTable);

export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type InsertMarketScheduleOverride = z.infer<typeof insertMarketScheduleOverrideSchema>;
export type InsertBuyItem = z.infer<typeof insertBuyItemSchema>;
export type InsertMarketBuyListState = z.infer<typeof insertMarketBuyListStateSchema>;
export type InsertMarketActualPurchase = z.infer<typeof insertMarketActualPurchaseSchema>;
export type InsertMarketCost = z.infer<typeof insertMarketCostSchema>;
export type InsertBouquetPlan = z.infer<typeof insertBouquetPlanSchema>;
export type InsertCloseMarket = z.infer<typeof insertCloseMarketSchema>;
export type Market = typeof marketsTable.$inferSelect;
export type MarketScheduleOverride = typeof marketScheduleOverridesTable.$inferSelect;
export type BuyItem = typeof buyItemsTable.$inferSelect;
export type MarketBuyListState = typeof marketBuyListStatesTable.$inferSelect;
export type MarketActualPurchase = typeof marketActualPurchasesTable.$inferSelect;
export type MarketCost = typeof marketCostsTable.$inferSelect;
export type BouquetPlan = typeof bouquetPlansTable.$inferSelect;
export type CloseMarket = typeof closeMarketsTable.$inferSelect;
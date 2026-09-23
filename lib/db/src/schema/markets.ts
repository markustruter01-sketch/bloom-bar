import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ReceiptCandidate = {
  flower: string;
  stems: number;
  unitCost: number;
  bunchSize?: number;
  bunchesPurchased?: number;
  pricePerBunch?: number;
  supplier?: string | null;
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

export type MarketDayTodoSnapshotItem = {
  description: string;
  completed: boolean;
  position: number;
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

export const marketBuyListEditLogsTable = pgTable(
  "market_buy_list_edit_logs",
  {
    id: serial("id").primaryKey(),
    marketCycle: integer("market_cycle")
      .notNull()
      .references(() => marketsTable.cycle, { onDelete: "cascade" }),
    action: text("action", { enum: ["unlocked", "item_updated", "relocked"] }).notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

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

export const flowerPriceBackfillsTable = pgTable(
  "flower_price_backfills",
  {
    id: serial("id").primaryKey(),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    flower: text("flower").notNull(),
    category: text("category", { enum: flowerCategories }).notNull(),
    supplier: text("supplier"),
    bunchSize: integer("bunch_size").notNull(),
    bunchesPurchased: integer("bunches_purchased").notNull(),
    pricePerBunch: doublePrecision("price_per_bunch").notNull(),
    totalStemQty: integer("total_stem_qty").generatedAlwaysAs(
      sql`"bunch_size" * "bunches_purchased"`,
    ),
    costPerStem: doublePrecision("cost_per_stem").generatedAlwaysAs(
      sql`CASE WHEN "bunch_size" > 0 THEN "price_per_bunch" / "bunch_size" ELSE 0 END`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    purchaseDateIndex: index("flower_price_backfills_purchase_date_idx").on(table.purchaseDate),
    categoryAllowed: check("flower_price_backfills_category_allowed", flowerCategoryConstraint),
    bunchSizePositive: check("flower_price_backfills_bunch_size_positive", sql`"bunch_size" > 0`),
    bunchesPurchasedPositive: check("flower_price_backfills_bunches_positive", sql`"bunches_purchased" > 0`),
    pricePerBunchNonNegative: check("flower_price_backfills_price_per_bunch_non_negative", sql`"price_per_bunch" >= 0`),
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

export const nonFlowerPurchasesTable = pgTable(
  "non_flower_purchases",
  {
    id: serial("id").primaryKey(),
    marketCycle: integer("market_cycle")
      .notNull()
      .references(() => marketsTable.cycle, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    totalPrice: doublePrecision("total_price").notNull(),
    quantity: integer("quantity").notNull(),
    productType: text("product_type"),
  },
  (table) => ({
    totalPriceNonNegative: check("non_flower_purchases_total_price_non_negative", sql`${table.totalPrice} >= 0`),
    quantityPositive: check("non_flower_purchases_quantity_positive", sql`${table.quantity} > 0`),
  }),
);

export const nonFlowerPurchaseAllocationsTable = pgTable(
  "non_flower_purchase_allocations",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => nonFlowerPurchasesTable.id, { onDelete: "cascade" }),
    productType: text("product_type").notNull(),
    allocationQuantity: integer("allocation_quantity"),
    allocationPercentage: doublePrecision("allocation_percentage"),
  },
  (table) => ({
    allocationBasis: check(
      "non_flower_purchase_allocations_one_basis",
      sql`(("allocation_quantity" IS NOT NULL AND "allocation_percentage" IS NULL) OR ("allocation_quantity" IS NULL AND "allocation_percentage" IS NOT NULL))`,
    ),
    allocationQuantityPositive: check(
      "non_flower_purchase_allocations_quantity_positive",
      sql`${table.allocationQuantity} IS NULL OR ${table.allocationQuantity} > 0`,
    ),
    allocationPercentagePositive: check(
      "non_flower_purchase_allocations_percentage_positive",
      sql`${table.allocationPercentage} IS NULL OR ${table.allocationPercentage} > 0`,
    ),
    allocationPercentageMaximum: check(
      "non_flower_purchase_allocations_percentage_maximum",
      sql`${table.allocationPercentage} IS NULL OR ${table.allocationPercentage} <= 100`,
    ),
  }),
);

export const nonFlowerBankImportsTable = pgTable(
  "non_flower_bank_imports",
  {
    id: serial("id").primaryKey(),
    marketCycle: integer("market_cycle")
      .notNull()
      .references(() => marketsTable.cycle, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileFormat: text("file_format", { enum: ["csv", "pdf"] }).notNull(),
    fileFingerprint: text("file_fingerprint").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cycleFingerprintUnique: unique("non_flower_bank_imports_cycle_fingerprint_unique").on(table.marketCycle, table.fileFingerprint),
  }),
);

export const nonFlowerBankImportLinesTable = pgTable(
  "non_flower_bank_import_lines",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => nonFlowerBankImportsTable.id, { onDelete: "cascade" }),
    sourceLineNumber: integer("source_line_number").notNull(),
    transactionDate: text("transaction_date"),
    merchant: text("merchant").notNull(),
    description: text("description").notNull(),
    amount: doublePrecision("amount").notNull(),
    reference: text("reference"),
  },
  (table) => ({
    sourceLinePositive: check("non_flower_bank_import_lines_source_line_positive", sql`${table.sourceLineNumber} > 0`),
    amountNonNegative: check("non_flower_bank_import_lines_amount_non_negative", sql`${table.amount} >= 0`),
  }),
);

export const nonFlowerBankImportDetailsTable = pgTable(
  "non_flower_bank_import_details",
  {
    id: serial("id").primaryKey(),
    lineId: integer("line_id")
      .notNull()
      .references(() => nonFlowerBankImportLinesTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    totalPrice: doublePrecision("total_price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => ({
    totalPriceNonNegative: check("non_flower_bank_import_details_total_price_non_negative", sql`${table.totalPrice} >= 0`),
    quantityPositive: check("non_flower_bank_import_details_quantity_positive", sql`${table.quantity} > 0`),
  }),
);

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
  notes: text("notes"),
  closed: boolean("closed").notNull().default(false),
});

export const marketDayTodoItemsTable = pgTable(
  "market_day_todo_items",
  {
    id: serial("id").primaryKey(),
    marketCycle: integer("market_cycle")
      .notNull()
      .references(() => marketsTable.cycle, { onDelete: "cascade" }),
    description: text("description").notNull(),
    completed: boolean("completed").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (table) => ({
    cyclePositionIndex: index("market_day_todo_items_cycle_position_idx").on(table.marketCycle, table.position, table.id),
  }),
);

export const marketDayTodoSnapshotsTable = pgTable("market_day_todo_snapshots", {
  marketCycle: integer("market_cycle")
    .primaryKey()
    .references(() => marketsTable.cycle, { onDelete: "cascade" }),
  items: jsonb("items").$type<MarketDayTodoSnapshotItem[]>().notNull().default([]),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flowerCareEntriesTable = pgTable(
  "flower_care_entries",
  {
    id: serial("id").primaryKey(),
    flower: text("flower").notNull(),
    instructions: text("instructions").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceStatus: text("source_status", { enum: ["auto-sourced", "manually-edited"] }).notNull().default("auto-sourced"),
    confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull().default("medium"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    flowerUnique: unique("flower_care_entries_flower_unique").on(table.flower),
  }),
);

export const flowerKnowledgeSectionKeys = [
  "vase-and-dried-life",
  "pairing-compatibility",
  "fragrance",
  "opens-indoors",
  "symbolic-meaning",
  "dries-well",
  "sun-sensitivity",
  "water-consumption",
  "pet-safety",
] as const;

export type FlowerKnowledgeSectionKey = (typeof flowerKnowledgeSectionKeys)[number];

export type FlowerKnowledgeSubvalue = {
  label: string;
  value: string;
};

export type FlowerKnowledgeSection = {
  key: FlowerKnowledgeSectionKey;
  label: string;
  value: string;
  subvalues?: FlowerKnowledgeSubvalue[];
  sourceName: string;
  sourceUrl: string;
  sourceStatus: "auto-sourced" | "manually-edited";
  confidence: "high" | "medium" | "low";
};

export const flowerKnowledgeEntriesTable = pgTable(
  "flower_knowledge_entries",
  {
    id: serial("id").primaryKey(),
    flower: text("flower").notNull(),
    sections: jsonb("sections").$type<FlowerKnowledgeSection[]>().notNull().default([]),
    sourceStatus: text("source_status", { enum: ["auto-sourced", "manually-edited"] }).notNull().default("auto-sourced"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    flowerUnique: unique("flower_knowledge_entries_flower_unique").on(table.flower),
  }),
);

export const insertMarketSchema = createInsertSchema(marketsTable).omit({ id: true });
export const insertMarketScheduleOverrideSchema = createInsertSchema(marketScheduleOverridesTable);
export const insertBuyItemSchema = createInsertSchema(buyItemsTable).omit({ id: true });
export const insertMarketBuyListStateSchema = createInsertSchema(marketBuyListStatesTable);
export const insertMarketBuyListEditLogSchema = createInsertSchema(marketBuyListEditLogsTable).omit({ id: true });
export const insertMarketActualPurchaseSchema = createInsertSchema(marketActualPurchasesTable).omit({ id: true });
export const insertFlowerPriceBackfillSchema = createInsertSchema(flowerPriceBackfillsTable).omit({ id: true, createdAt: true });
export const insertMarketCostSchema = createInsertSchema(marketCostsTable).omit({ id: true });
export const insertNonFlowerPurchaseSchema = createInsertSchema(nonFlowerPurchasesTable).omit({ id: true });
export const insertNonFlowerPurchaseAllocationSchema = createInsertSchema(nonFlowerPurchaseAllocationsTable).omit({ id: true });
export const insertNonFlowerBankImportSchema = createInsertSchema(nonFlowerBankImportsTable).omit({ id: true, importedAt: true });
export const insertNonFlowerBankImportLineSchema = createInsertSchema(nonFlowerBankImportLinesTable).omit({ id: true });
export const insertNonFlowerBankImportDetailSchema = createInsertSchema(nonFlowerBankImportDetailsTable).omit({ id: true });
export const insertBouquetPlanSchema = createInsertSchema(bouquetPlansTable);
export const insertCloseMarketSchema = createInsertSchema(closeMarketsTable);
export const insertMarketDayTodoItemSchema = createInsertSchema(marketDayTodoItemsTable).omit({ id: true });
export const insertMarketDayTodoSnapshotSchema = createInsertSchema(marketDayTodoSnapshotsTable);
export const insertFlowerCareEntrySchema = createInsertSchema(flowerCareEntriesTable).omit({ id: true, updatedAt: true });
export const insertFlowerKnowledgeEntrySchema = createInsertSchema(flowerKnowledgeEntriesTable).omit({ id: true, updatedAt: true });

export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type InsertMarketScheduleOverride = z.infer<typeof insertMarketScheduleOverrideSchema>;
export type InsertBuyItem = z.infer<typeof insertBuyItemSchema>;
export type InsertMarketBuyListState = z.infer<typeof insertMarketBuyListStateSchema>;
export type InsertMarketBuyListEditLog = z.infer<typeof insertMarketBuyListEditLogSchema>;
export type InsertMarketActualPurchase = z.infer<typeof insertMarketActualPurchaseSchema>;
export type InsertFlowerPriceBackfill = z.infer<typeof insertFlowerPriceBackfillSchema>;
export type InsertMarketCost = z.infer<typeof insertMarketCostSchema>;
export type InsertNonFlowerPurchase = z.infer<typeof insertNonFlowerPurchaseSchema>;
export type InsertNonFlowerPurchaseAllocation = z.infer<typeof insertNonFlowerPurchaseAllocationSchema>;
export type InsertNonFlowerBankImport = z.infer<typeof insertNonFlowerBankImportSchema>;
export type InsertNonFlowerBankImportLine = z.infer<typeof insertNonFlowerBankImportLineSchema>;
export type InsertNonFlowerBankImportDetail = z.infer<typeof insertNonFlowerBankImportDetailSchema>;
export type InsertBouquetPlan = z.infer<typeof insertBouquetPlanSchema>;
export type InsertCloseMarket = z.infer<typeof insertCloseMarketSchema>;
export type InsertMarketDayTodoItem = z.infer<typeof insertMarketDayTodoItemSchema>;
export type InsertMarketDayTodoSnapshot = z.infer<typeof insertMarketDayTodoSnapshotSchema>;
export type Market = typeof marketsTable.$inferSelect;
export type MarketScheduleOverride = typeof marketScheduleOverridesTable.$inferSelect;
export type BuyItem = typeof buyItemsTable.$inferSelect;
export type MarketBuyListState = typeof marketBuyListStatesTable.$inferSelect;
export type MarketBuyListEditLog = typeof marketBuyListEditLogsTable.$inferSelect;
export type MarketActualPurchase = typeof marketActualPurchasesTable.$inferSelect;
export type FlowerPriceBackfill = typeof flowerPriceBackfillsTable.$inferSelect;
export type MarketCost = typeof marketCostsTable.$inferSelect;
export type NonFlowerPurchase = typeof nonFlowerPurchasesTable.$inferSelect;
export type NonFlowerPurchaseAllocation = typeof nonFlowerPurchaseAllocationsTable.$inferSelect;
export type NonFlowerBankImport = typeof nonFlowerBankImportsTable.$inferSelect;
export type NonFlowerBankImportLine = typeof nonFlowerBankImportLinesTable.$inferSelect;
export type NonFlowerBankImportDetail = typeof nonFlowerBankImportDetailsTable.$inferSelect;
export type BouquetPlan = typeof bouquetPlansTable.$inferSelect;
export type CloseMarket = typeof closeMarketsTable.$inferSelect;
export type MarketDayTodoItem = typeof marketDayTodoItemsTable.$inferSelect;
export type MarketDayTodoSnapshot = typeof marketDayTodoSnapshotsTable.$inferSelect;
export type FlowerCareEntry = typeof flowerCareEntriesTable.$inferSelect;
export type FlowerKnowledgeEntry = typeof flowerKnowledgeEntriesTable.$inferSelect;
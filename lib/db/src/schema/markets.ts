import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

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
  category: text("category").notNull(),
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
  closed: boolean("closed").notNull().default(false),
});

export const insertMarketSchema = createInsertSchema(marketsTable).omit({ id: true });
export const insertBuyItemSchema = createInsertSchema(buyItemsTable).omit({ id: true });
export const insertBouquetPlanSchema = createInsertSchema(bouquetPlansTable);
export const insertCloseMarketSchema = createInsertSchema(closeMarketsTable);

export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type InsertBuyItem = z.infer<typeof insertBuyItemSchema>;
export type InsertBouquetPlan = z.infer<typeof insertBouquetPlanSchema>;
export type InsertCloseMarket = z.infer<typeof insertCloseMarketSchema>;
export type Market = typeof marketsTable.$inferSelect;
export type BuyItem = typeof buyItemsTable.$inferSelect;
export type BouquetPlan = typeof bouquetPlansTable.$inferSelect;
export type CloseMarket = typeof closeMarketsTable.$inferSelect;
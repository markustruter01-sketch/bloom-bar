const MARKET_ANCHOR = new Date(Date.UTC(2026, 7, 30));
const DAYS_IN_FORTNIGHT = 14;
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MarketScheduleOverride = {
  marketCycle: number;
  status: "skipped" | "rescheduled";
  rescheduledDate: string | null;
};

export function getCalculatedMarketDate(cycle: number): string {
  const date = new Date(MARKET_ANCHOR);
  date.setUTCDate(date.getUTCDate() + cycle * DAYS_IN_FORTNIGHT);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getScheduledMarketDate(
  cycle: number,
  overrides: readonly MarketScheduleOverride[] = [],
): string {
  const override = overrides.find((candidate) => candidate.marketCycle === cycle);
  return override?.status === "rescheduled" && override.rescheduledDate
    ? override.rescheduledDate
    : getCalculatedMarketDate(cycle);
}

export function isSkippedMarketCycle(
  cycle: number,
  overrides: readonly MarketScheduleOverride[] = [],
): boolean {
  return overrides.some((candidate) => candidate.marketCycle === cycle && candidate.status === "skipped");
}

export function formatScheduledMarketDate(
  cycle: number,
  overrides: readonly MarketScheduleOverride[] = [],
): string {
  const date = new Date(`${getScheduledMarketDate(cycle, overrides)}T00:00:00Z`);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${shortMonths[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
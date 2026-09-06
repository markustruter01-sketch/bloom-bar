const MARKET_ANCHOR = new Date(Date.UTC(2026, 8, 13));
const DAYS_IN_FORTNIGHT = 14;
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getScheduledMarketDate(cycle: number): string {
  const date = new Date(MARKET_ANCHOR);
  date.setUTCDate(date.getUTCDate() + cycle * DAYS_IN_FORTNIGHT);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatScheduledMarketDate(cycle: number): string {
  const date = new Date(`${getScheduledMarketDate(cycle)}T00:00:00Z`);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${shortMonths[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
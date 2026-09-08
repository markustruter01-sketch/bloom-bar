const DAYS_IN_FORTNIGHT = 14;
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const MARKET_ANCHOR = new Date(Date.UTC(2026, 8, 13));

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type MarketDateFormat = 'full' | 'short' | 'table';
export type MarketStatus = 'Closed' | 'Next up' | 'Upcoming';
export type MarketCycleSummary = {
  cycle: number;
  date: Date;
  fullDate: string;
  shortDate: string;
  daysUntil: string;
  recurrence: string;
  status: MarketStatus;
};

/**
 * Returns the market date for a fortnightly cycle relative to the confirmed
 * anchor. Cycle 0 is the first market on Sunday 13 September 2026.
 *
 * UTC date arithmetic keeps the schedule on Sundays across daylight-saving
 * changes and year boundaries.
 */
export function getMarketDate(cycle: number): Date {
  if (!Number.isInteger(cycle)) {
    throw new Error('Market cycle must be an integer.');
  }

  const date = new Date(MARKET_ANCHOR);
  date.setUTCDate(date.getUTCDate() + cycle * DAYS_IN_FORTNIGHT);
  return date;
}

export function formatMarketDate(date: Date, format: MarketDateFormat): string {
  const weekday = weekdays[date.getUTCDay()];
  const day = date.getUTCDate();
  const month = format === 'full' ? longMonths[date.getUTCMonth()] : shortMonths[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  if (format === 'full') {
    return `${weekday} · ${day} ${month} ${year}`;
  }

  if (format === 'short') {
    return `${weekday} ${day} ${month}`;
  }

  return `${String(day).padStart(2, '0')} ${month} ${year}`;
}

export function formatMarketDay(date: Date): string {
  return weekdays[date.getUTCDay()];
}

export function daysUntilMarket(date: Date, today = new Date()): number {
  const targetDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const currentDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.ceil((targetDay - currentDay) / MILLISECONDS_IN_DAY));
}

export function getNextMarketCycle(today = new Date()): number {
  const currentDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const anchorDay = Date.UTC(MARKET_ANCHOR.getUTCFullYear(), MARKET_ANCHOR.getUTCMonth(), MARKET_ANCHOR.getUTCDate());
  const daysSinceAnchor = Math.floor((currentDay - anchorDay) / MILLISECONDS_IN_DAY);
  return Math.max(0, Math.ceil(daysSinceAnchor / DAYS_IN_FORTNIGHT));
}

export function getMarketStatus(cycle: number, nextCycle: number): MarketStatus {
  if (cycle < nextCycle) {
    return 'Closed';
  }

  return cycle === nextCycle ? 'Next up' : 'Upcoming';
}

export function getMarketCycleSummary(today = new Date()): MarketCycleSummary {
  const cycle = getNextMarketCycle(today);
  const date = getMarketDate(cycle);
  const days = daysUntilMarket(date, today);

  return {
    cycle,
    date,
    fullDate: formatMarketDate(date, 'full'),
    shortDate: formatMarketDate(date, 'short'),
    daysUntil: days === 0 ? 'Today' : `${days} days`,
    recurrence: 'Every fortnight on Sunday',
    status: getMarketStatus(cycle, cycle),
  };
}

export const marketSchedule = {
  recurrence: 'Every fortnight on Sunday',
  dateForCycle: getMarketDate,
  formatDate: formatMarketDate,
  formatDay: formatMarketDay,
  daysUntil: daysUntilMarket,
  nextCycle: getNextMarketCycle,
  statusForCycle: getMarketStatus,
  nextSummary: getMarketCycleSummary,
} as const;
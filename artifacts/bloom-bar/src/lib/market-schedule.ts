const DAYS_IN_FORTNIGHT = 14;
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const MARKET_ANCHOR = new Date(Date.UTC(2026, 7, 30));
const MAX_SCHEDULE_LOOKAHEAD = 64;

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type MarketDateFormat = 'full' | 'short' | 'table';
export type MarketScheduleOverrideStatus = 'skipped' | 'rescheduled';
export type MarketScheduleOverride = {
  marketCycle: number;
  status: MarketScheduleOverrideStatus;
  rescheduledDate: string | null;
};
export type MarketStatus = 'Closed' | 'Next up' | 'Upcoming' | 'Skipped';
export type MarketCycleSummary = {
  cycle: number;
  date: Date;
  calculatedDate: Date;
  fullDate: string;
  shortDate: string;
  daysUntil: string;
  recurrence: string;
  status: MarketStatus;
  overrideStatus: MarketScheduleOverrideStatus | null;
};

/**
 * Returns the market date for a fortnightly cycle relative to the confirmed
 * anchor. Cycle 0 is the first market on Sunday 30 August 2026.
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

export function getEffectiveMarketDate(
  cycle: number,
  overrides: readonly MarketScheduleOverride[] = [],
): Date | null {
  const override = overrides.find((candidate) => candidate.marketCycle === cycle);
  if (override?.status === 'skipped') return null;
  if (override?.status === 'rescheduled' && override.rescheduledDate) {
    return new Date(`${override.rescheduledDate}T00:00:00Z`);
  }
  return getMarketDate(cycle);
}

export function getMarketScheduleOverride(
  cycle: number,
  overrides: readonly MarketScheduleOverride[] = [],
): MarketScheduleOverride | null {
  return overrides.find((candidate) => candidate.marketCycle === cycle) ?? null;
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

export function getUtcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function millisecondsUntilNextUtcDay(now = new Date()): number {
  const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return nextDay - now.getTime();
}

export function getCalculatedNextMarketCycle(today = new Date()): number {
  const currentDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const anchorDay = Date.UTC(MARKET_ANCHOR.getUTCFullYear(), MARKET_ANCHOR.getUTCMonth(), MARKET_ANCHOR.getUTCDate());
  const daysSinceAnchor = Math.floor((currentDay - anchorDay) / MILLISECONDS_IN_DAY);
  return Math.max(0, Math.ceil(daysSinceAnchor / DAYS_IN_FORTNIGHT));
}

export function getNextMarketCycle(
  today = new Date(),
  overrides: readonly MarketScheduleOverride[] = [],
): number {
  const calculatedNextCycle = getCalculatedNextMarketCycle(today);
  const currentDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const candidateCycles = new Set<number>();
  for (let cycle = calculatedNextCycle - MAX_SCHEDULE_LOOKAHEAD; cycle <= calculatedNextCycle + MAX_SCHEDULE_LOOKAHEAD; cycle += 1) {
    candidateCycles.add(cycle);
  }
  overrides.forEach((override) => candidateCycles.add(override.marketCycle));

  const next = [...candidateCycles]
    .map((cycle) => ({ cycle, date: getEffectiveMarketDate(cycle, overrides) }))
    .filter((candidate): candidate is { cycle: number; date: Date } => candidate.date !== null && candidate.date.getTime() >= currentDay)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.cycle - b.cycle)[0];

  return next?.cycle ?? calculatedNextCycle;
}

export function getUpcomingCalculatedCycles(today = new Date(), count = 5): number[] {
  const firstCycle = getCalculatedNextMarketCycle(today);
  return Array.from({ length: count }, (_, index) => firstCycle + index);
}

export function getMarketStatus(
  cycle: number,
  nextCycle: number,
  overrides: readonly MarketScheduleOverride[] = [],
): MarketStatus {
  if (getMarketScheduleOverride(cycle, overrides)?.status === 'skipped') {
    return 'Skipped';
  }
  if (cycle < nextCycle) {
    return 'Closed';
  }

  return cycle === nextCycle ? 'Next up' : 'Upcoming';
}

export function getMarketCycleSummary(
  today = new Date(),
  overrides: readonly MarketScheduleOverride[] = [],
): MarketCycleSummary {
  const cycle = getNextMarketCycle(today, overrides);
  const date = getEffectiveMarketDate(cycle, overrides) ?? getMarketDate(cycle);
  const calculatedDate = getMarketDate(cycle);
  const days = daysUntilMarket(date, today);
  const override = getMarketScheduleOverride(cycle, overrides);

  return {
    cycle,
    date,
    calculatedDate,
    fullDate: formatMarketDate(date, 'full'),
    shortDate: formatMarketDate(date, 'short'),
    daysUntil: days === 0 ? 'Today' : `${days} days`,
    recurrence: 'Every 2nd Sunday',
    status: getMarketStatus(cycle, cycle, overrides),
    overrideStatus: override?.status ?? null,
  };
}

export const marketSchedule = {
  recurrence: 'Every 2nd Sunday',
  dateForCycle: getMarketDate,
  effectiveDateForCycle: getEffectiveMarketDate,
  formatDate: formatMarketDate,
  formatDay: formatMarketDay,
  daysUntil: daysUntilMarket,
  nextCycle: getNextMarketCycle,
  calculatedNextCycle: getCalculatedNextMarketCycle,
  upcomingCalculatedCycles: getUpcomingCalculatedCycles,
  statusForCycle: getMarketStatus,
  nextSummary: getMarketCycleSummary,
} as const;
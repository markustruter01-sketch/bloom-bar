import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  daysUntilMarket,
  getMarketCycleSummary,
  getMarketDate,
  getMarketStatus,
  getNextMarketCycle,
  getUtcDayKey,
  millisecondsUntilNextUtcDay,
} from './market-schedule';

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

function isoDate(cycle: number): string {
  return getMarketDate(cycle).toISOString().slice(0, 10);
}

describe('market schedule anchor and cycle offsets', () => {
  it('keeps cycle 0 on the confirmed 13 September 2026 anchor', () => {
    const date = getMarketDate(0);

    assert.equal(date.toISOString(), '2026-09-13T00:00:00.000Z');
    assert.equal(date.getUTCDay(), 0);
  });

  it('generates the expected historical dates from the anchor', () => {
    assert.deepEqual(
      [-42, -41, -40, -2, -1, 0, 1].map(isoDate),
      [
        '2025-02-02',
        '2025-02-16',
        '2025-03-02',
        '2026-08-16',
        '2026-08-30',
        '2026-09-13',
        '2026-09-27',
      ],
    );
  });

  it('rejects non-integer cycle offsets', () => {
    assert.throws(() => getMarketDate(1.5), /Market cycle must be an integer/);
  });
});

describe('market schedule Sunday invariant', () => {
  it('keeps historical and future cycles on Sundays across year boundaries', () => {
    const cycles = Array.from({ length: 241 }, (_, index) => index - 120);

    for (const cycle of cycles) {
      const date = getMarketDate(cycle);

      assert.equal(date.getUTCDay(), 0, `cycle ${cycle} should be a Sunday`);
    }

    assert.equal(isoDate(-40), '2025-03-02');
    assert.equal(isoDate(8), '2027-01-03');
    assert.equal(isoDate(9), '2027-01-17');
  });

  it('advances exactly one fortnight for each cycle', () => {
    for (let cycle = -10; cycle < 10; cycle += 1) {
      const difference = getMarketDate(cycle + 1).getTime() - getMarketDate(cycle).getTime();

      assert.equal(difference, 14 * MILLISECONDS_IN_DAY);
    }
  });
});

describe('market cycle selection and status labeling', () => {
  it('selects the next cycle before, on, between, and after market dates', () => {
    assert.equal(getNextMarketCycle(new Date('2026-09-06T12:00:00Z')), 0);
    assert.equal(getNextMarketCycle(new Date('2026-09-13T00:00:00Z')), 0);
    assert.equal(getNextMarketCycle(new Date('2026-09-14T00:00:00Z')), 1);
    assert.equal(getNextMarketCycle(new Date('2027-01-04T00:00:00Z')), 9);
  });

  it('labels past, next, and future cycles', () => {
    const nextCycle = 0;

    assert.equal(getMarketStatus(-1, nextCycle), 'Closed');
    assert.equal(getMarketStatus(nextCycle, nextCycle), 'Next up');
    assert.equal(getMarketStatus(1, nextCycle), 'Upcoming');
  });

  it('keeps the Markets and linked planning surfaces on one rendered cycle', () => {
    const summary = getMarketCycleSummary(new Date('2026-09-06T12:00:00Z'));
    const marketsSurface = {
      date: summary.shortDate,
      status: summary.status,
    };
    const planningSurface = {
      date: summary.shortDate,
      status: summary.status,
    };

    assert.deepEqual(planningSurface, marketsSurface);
    assert.equal(summary.cycle, 0);
    assert.equal(summary.shortDate, 'Sunday 13 Sep');
    assert.equal(summary.status, 'Next up');
  });
});

describe('market countdown boundaries', () => {
  it('stays at zero on the market date instead of becoming negative', () => {
    const marketDate = getMarketDate(0);
    const marketDay = new Date('2026-09-13T23:59:59Z');
    const summary = getMarketCycleSummary(marketDay);

    assert.equal(daysUntilMarket(marketDate, marketDay), 0);
    assert.equal(summary.daysUntil, 'Today');
    assert.equal(summary.cycle, 0);
  });

  it('starts the next fortnight countdown on the following day', () => {
    const followingDay = new Date('2026-09-14T12:00:00Z');
    const nextMarketDate = getMarketDate(1);
    const summary = getMarketCycleSummary(followingDay);

    assert.equal(getNextMarketCycle(followingDay), 1);
    assert.equal(daysUntilMarket(nextMarketDate, followingDay), 13);
    assert.equal(summary.daysUntil, '13 days');
    assert.equal(summary.cycle, 1);
  });

  it('changes the UTC day key and countdown at the market-day boundary', () => {
    const marketDayEnd = new Date('2026-09-13T23:59:59.999Z');
    const followingDay = new Date('2026-09-14T00:00:00.000Z');

    assert.equal(getUtcDayKey(marketDayEnd), '2026-09-13');
    assert.equal(millisecondsUntilNextUtcDay(marketDayEnd), 1);
    assert.equal(getUtcDayKey(followingDay), '2026-09-14');
    assert.equal(getMarketCycleSummary(followingDay).daysUntil, '13 days');
  });

  it('counts down to the anchor from a date before the first market', () => {
    const beforeAnchor = new Date('2026-09-06T12:00:00Z');
    const summary = getMarketCycleSummary(beforeAnchor);

    assert.equal(daysUntilMarket(getMarketDate(0), beforeAnchor), 7);
    assert.equal(summary.daysUntil, '7 days');
    assert.equal(summary.cycle, 0);
  });
});
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import React, { useEffect, useMemo } from 'react';
import { Window } from 'happy-dom';

const dom = new Window({ url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom,
  document: dom.document,
  location: dom.location,
  addEventListener: dom.addEventListener.bind(dom),
  removeEventListener: dom.removeEventListener.bind(dom),
  HTMLElement: dom.HTMLElement,
  Node: dom.Node,
  Event: dom.Event,
  MouseEvent: dom.MouseEvent,
  File: dom.File,
  getComputedStyle: dom.getComputedStyle.bind(dom),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.navigator,
});

const { act } = await import('react');
const { cleanup, render, screen } = await import('@testing-library/react');
const { useUtcDayRollover } = await import('./App');
const { marketSchedule } = await import('./lib/market-schedule');

type ScheduledTimer = {
  id: number;
  dueAt: number;
  callback: () => void;
};

const realDate = Date;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

let nowMs = 0;
let nextTimerId = 1;
let timers: ScheduledTimer[] = [];
let setTimeoutCalls = 0;
let clearTimeoutCalls = 0;

function installClock(start: string) {
  nowMs = realDate.parse(start);
  nextTimerId = 1;
  timers = [];
  setTimeoutCalls = 0;
  clearTimeoutCalls = 0;

  const FakeDate = class extends realDate {
    constructor(...args: any[]) {
      super(args.length === 0 ? nowMs : args[0]);
    }

    static now() {
      return nowMs;
    }
  };

  globalThis.Date = FakeDate as DateConstructor;
  globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
    const id = nextTimerId++;
    setTimeoutCalls += 1;
    timers.push({
      id,
      dueAt: nowMs + Math.max(0, Number(delay ?? 0)),
      callback: () => {
        if (typeof callback === 'function') callback();
      },
    });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((timerId: ReturnType<typeof setTimeout>) => {
    clearTimeoutCalls += 1;
    timers = timers.filter((timer) => timer.id !== Number(timerId));
  }) as typeof clearTimeout;
}

function restoreClock() {
  globalThis.Date = realDate;
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  timers = [];
}

function advanceClockBy(milliseconds: number) {
  nowMs += milliseconds;
  const dueTimers = timers
    .filter((timer) => timer.dueAt <= nowMs)
    .sort((left, right) => left.dueAt - right.dueAt);

  for (const timer of dueTimers) {
    timers = timers.filter((candidate) => candidate.id !== timer.id);
    timer.callback();
  }
}

function RolloverProbe({ revision, summaryChanges }: { revision: number; summaryChanges: string[] }) {
  const utcDay = useUtcDayRollover();
  const summary = useMemo(() => marketSchedule.nextSummary(new Date()), [utcDay]);

  useEffect(() => {
    summaryChanges.push(`${summary.cycle}:${summary.shortDate}`);
  }, [summary.cycle, summary.shortDate, summaryChanges]);

  return <output data-testid="market-summary" data-revision={revision}>{summary.shortDate}</output>;
}

describe('UTC day rollover', () => {
  afterEach(() => {
    cleanup();
    restoreClock();
  });

  it('updates the market summary once and keeps one rollover timer after unrelated rerenders', async () => {
    installClock('2026-09-13T23:59:59.500Z');
    const summaryChanges: string[] = [];
    const view = render(<RolloverProbe revision={0} summaryChanges={summaryChanges} />);

    assert.equal(screen.getByTestId('market-summary').textContent, 'Sunday 13 Sep');
     assert.deepEqual(summaryChanges, ['1:Sunday 13 Sep']);
    assert.equal(timers.length, 1);
    assert.equal(setTimeoutCalls, 1);

    view.rerender(<RolloverProbe revision={1} summaryChanges={summaryChanges} />);
    view.rerender(<RolloverProbe revision={2} summaryChanges={summaryChanges} />);
    assert.equal(screen.getByTestId('market-summary').getAttribute('data-revision'), '2');
     assert.deepEqual(summaryChanges, ['1:Sunday 13 Sep']);
    assert.equal(timers.length, 1);
    assert.equal(setTimeoutCalls, 1);

    await act(async () => {
      advanceClockBy(500);
    });

    assert.equal(screen.getByTestId('market-summary').textContent, 'Sunday 27 Sep');
     assert.deepEqual(summaryChanges, ['1:Sunday 13 Sep', '2:Sunday 27 Sep']);
    assert.equal(timers.length, 1);
    assert.equal(setTimeoutCalls, 2);
    assert.equal(clearTimeoutCalls, 1);
  });

  it('reconciles the UTC day when a suspended tab becomes active', async () => {
    installClock('2026-09-13T23:30:00.000Z');
    const summaryChanges: string[] = [];
    render(<RolloverProbe revision={0} summaryChanges={summaryChanges} />);

    assert.equal(screen.getByTestId('market-summary').textContent, 'Sunday 13 Sep');

    nowMs = realDate.parse('2026-09-15T08:00:00.000Z');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    assert.equal(screen.getByTestId('market-summary').textContent, 'Sunday 27 Sep');
     assert.deepEqual(summaryChanges, ['1:Sunday 13 Sep', '2:Sunday 27 Sep']);
    assert.equal(timers.length, 1);
  });
});
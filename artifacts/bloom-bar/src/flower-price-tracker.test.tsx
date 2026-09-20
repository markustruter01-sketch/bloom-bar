import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import React from 'react';
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
  getComputedStyle: dom.getComputedStyle.bind(dom),
  IS_REACT_ACT_ENVIRONMENT: true,
});

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.navigator,
});

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { FlowerPriceTracker, FlowerPriceTrackerPage } = await import('./App');

const priceHistory = [{
  flower: 'Lisianthus',
  category: 'Classic Blooms' as const,
  latest: { marketCycle: 0, date: '13 Sep 2026', pricePerBunch: 3.2, costPerStem: 3.2, unitCost: 3.2 },
  previous: { marketCycle: -1, date: '30 Aug 2026', pricePerBunch: 2.8, costPerStem: 2.8, unitCost: 2.8 },
  change: 0.4,
  changePercent: 14.2857,
  history: [
    { marketCycle: 0, date: '13 Sep 2026', pricePerBunch: 3.2, costPerStem: 3.2, unitCost: 3.2 },
    { marketCycle: -1, date: '30 Aug 2026', pricePerBunch: 2.8, costPerStem: 2.8, unitCost: 2.8 },
    { marketCycle: -2, date: '16 Aug 2026', pricePerBunch: 2.55, costPerStem: 2.55, unitCost: 2.55 },
  ],
}];

describe('flower price history disclosure', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the latest/previous summary primary and reveals all reported prices on demand', () => {
    render(<FlowerPriceTracker prices={priceHistory} isLoading={false} />);

    const toggle = screen.getByTestId('button-toggle-flower-history-lisianthus');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(screen.queryByTestId('panel-flower-history-lisianthus'), null);
    assert.match(screen.getByText('13 Sep 2026').textContent ?? '', /13 Sep 2026/);

    fireEvent.click(toggle);

    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const panel = screen.getByTestId('panel-flower-history-lisianthus');
    assert.match(panel.textContent ?? '', /13 Sep 2026/);
    assert.match(panel.textContent ?? '', /30 Aug 2026/);
    assert.match(panel.textContent ?? '', /16 Aug 2026/);
    assert.match(panel.textContent ?? '', /3 reports/);
    assert.match(panel.textContent ?? '', /\$3\.20/);

    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(screen.queryByTestId('panel-flower-history-lisianthus'), null);
  });
});

describe('reported purchase line-item tracker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps each supplier line visible under its market-date tab', () => {
    render(<FlowerPriceTrackerPage reports={[
      {
        marketCycle: 2,
        date: '03 Oct 2371',
        venue: 'Redcliffe Markets',
        lineItems: [
          {
            id: 101,
            marketCycle: 2,
            flower: 'David Austin roses',
            supplier: 'Supplier A',
            bunchSize: 10,
            bunchesPurchased: 2,
            pricePerBunch: 18,
            totalStemQty: 20,
            costPerStem: 1.8,
          },
          {
            id: 102,
            marketCycle: 2,
            flower: 'David Austin roses',
            supplier: 'Supplier B',
            bunchSize: 10,
            bunchesPurchased: 3,
            pricePerBunch: 20,
            totalStemQty: 30,
            costPerStem: 2,
          },
        ],
      },
      {
        marketCycle: 1,
        date: '19 Sep 2371',
        venue: 'Redcliffe Markets',
        lineItems: [{
          id: 103,
          marketCycle: 1,
          flower: 'Lisianthus',
          supplier: null,
          bunchSize: 5,
          bunchesPurchased: 1,
          pricePerBunch: 12,
          totalStemQty: 5,
          costPerStem: 2.4,
        }],
      },
    ]} isLoading={false} />);

    assert.equal(screen.getByTestId('tab-flower-price-tracker-2').getAttribute('aria-selected'), 'true');
    const firstReport = screen.getByTestId('report-flower-price-tracker-2');
    assert.match(firstReport.textContent ?? '', /Supplier A/);
    assert.match(firstReport.textContent ?? '', /Supplier B/);
    assert.match(firstReport.textContent ?? '', /\$18\.00/);
    assert.match(firstReport.textContent ?? '', /\$1\.80/);
    assert.match(firstReport.textContent ?? '', /20/);
    assert.match(firstReport.textContent ?? '', /30/);
    assert.equal(screen.getAllByTestId(/tracker-line-item-/).length, 2);

    fireEvent.click(screen.getByTestId('tab-flower-price-tracker-1'));

    assert.equal(screen.getByTestId('tab-flower-price-tracker-1').getAttribute('aria-selected'), 'true');
    assert.match(screen.getByTestId('report-flower-price-tracker-1').textContent ?? '', /Lisianthus/);
    assert.equal(screen.getAllByTestId(/tracker-line-item-/).length, 1);
  });
});
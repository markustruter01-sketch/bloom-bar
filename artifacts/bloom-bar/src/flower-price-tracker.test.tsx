import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import React from 'react';
import { Window } from 'happy-dom';

const dom = new Window({ url: 'http://localhost/' });
Object.assign(globalThis, {
  React,
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

const { act, cleanup, fireEvent, render, screen } = await import('@testing-library/react');
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
        notes: 'Rain arrived early.',
        lineItems: [
          {
            id: 101,
            marketCycle: 2,
            flower: 'David Austin roses',
            canonicalFlower: 'David Austin roses',
            supplier: 'Supplier A',
            bunchSize: 10,
            bunchesPurchased: 2,
            pricePerBunch: 18,
            totalStemQty: 20,
            costPerStem: 1.8,
            sellThrough: { flower: 'David Austin roses', purchasedStems: 20, leftoverStems: 4, soldStems: 16, sellThroughPercent: 80 },
          },
          {
            id: 102,
            marketCycle: 2,
            flower: 'David Austin roses',
            canonicalFlower: 'David Austin roses',
            supplier: 'Supplier B',
            bunchSize: 10,
            bunchesPurchased: 3,
            pricePerBunch: 20,
            totalStemQty: 30,
            costPerStem: 2,
            sellThrough: null,
          },
        ],
      },
      {
        marketCycle: 1,
        date: '19 Sep 2371',
        venue: 'Redcliffe Markets',
        notes: null,
        lineItems: [{
          id: 103,
          marketCycle: 1,
          flower: 'Lisianthus',
          canonicalFlower: 'Lisianthus',
          supplier: null,
          bunchSize: 5,
          bunchesPurchased: 1,
          pricePerBunch: 12,
          totalStemQty: 5,
          costPerStem: 2.4,
          sellThrough: null,
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
    assert.match(firstReport.textContent ?? '', /Rain arrived early/);
    assert.match(firstReport.textContent ?? '', /80% sold through/);
    assert.equal(screen.getAllByTestId(/tracker-line-item-/).length, 2);

    fireEvent.click(screen.getByTestId('tab-flower-price-tracker-1'));

    assert.equal(screen.getByTestId('tab-flower-price-tracker-1').getAttribute('aria-selected'), 'true');
    assert.match(screen.getByTestId('report-flower-price-tracker-1').textContent ?? '', /Lisianthus/);
    assert.equal(screen.getAllByTestId(/tracker-line-item-/).length, 1);
  });
});

describe('flower price dashboard states and backfill entry point', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('shows not enough data yet for a single market observation', () => {
    render(<FlowerPriceTrackerPage reports={[]} isLoading={false} dashboardObservations={[{
      id: 1,
      purchaseDate: '2026-08-30',
      flower: 'Waratah',
      canonicalFlower: 'Waratah',
      category: 'Premium Natives',
      trackerCategory: null,
      supplier: 'Supplier A',
      bunchSize: 10,
      bunchesPurchased: 1,
      pricePerBunch: 30,
      totalStemQty: 10,
      costPerStem: 3,
      source: 'reported',
      marketCycle: 0,
      sellThrough: null,
      marketNotes: null,
    }]} dashboardLoading={false} />);

    assert.match(screen.getByTestId('trend-not-enough-waratah').textContent ?? '', /Not enough data yet/);
    assert.match(screen.getByTestId('seasonal-row-waratah').textContent ?? '', /Not enough data yet/);
    assert.match(screen.getByTestId('flower-price-dashboard').textContent ?? '', /Early days/);
  });

  it('hides excluded flowers from active tracker views while keeping the full export available', () => {
    const observations = [
      {
        id: 1,
        purchaseDate: '2026-09-12',
        flower: 'Billy buttons',
        canonicalFlower: 'Billy buttons',
        category: 'Textural Foliage' as const,
        trackerCategory: 'Textural foliage' as const,
        supplier: 'Supplier A',
        bunchSize: 10,
        bunchesPurchased: 1,
        pricePerBunch: 13.5,
        totalStemQty: 10,
        costPerStem: 1.35,
        source: 'reported' as const,
        marketCycle: 1,
        sellThrough: null,
        marketNotes: null,
      },
      {
        id: 2,
        purchaseDate: '2026-09-12',
        flower: 'Queen Anne’s lace',
        canonicalFlower: 'Queen Anne’s lace',
        category: 'Textural Foliage' as const,
        trackerCategory: 'Textural foliage' as const,
        supplier: 'Supplier B',
        bunchSize: 10,
        bunchesPurchased: 1,
        pricePerBunch: 18,
        totalStemQty: 10,
        costPerStem: 1.8,
        source: 'reported' as const,
        marketCycle: 1,
        sellThrough: null,
        marketNotes: null,
      },
      {
        id: 3,
        purchaseDate: '2026-09-12',
        flower: 'Snapdragon',
        canonicalFlower: 'Snapdragon',
        category: 'Classic Blooms' as const,
        trackerCategory: 'Classic blooms' as const,
        supplier: 'Supplier C',
        bunchSize: 10,
        bunchesPurchased: 1,
        pricePerBunch: 20,
        totalStemQty: 10,
        costPerStem: 2,
        source: 'reported' as const,
        marketCycle: 1,
        sellThrough: null,
        marketNotes: null,
      },
    ];
    render(<FlowerPriceTrackerPage reports={[]} isLoading={false} dashboardObservations={observations} dashboardLoading={false} />);

    assert.equal(screen.queryByTestId('dashboard-average-billy-buttons'), null);
    assert.equal(screen.queryByTestId('dashboard-average-queen-anne-s-lace'), null);
    assert.ok(screen.getByTestId('dashboard-average-snapdragon'));
    assert.equal(screen.getByTestId('button-export-flower-price-csv').hasAttribute('disabled'), false);
  });

  it('opens the historical backfill form and submits a past purchase', async () => {
    const saved: unknown[] = [];
    render(<FlowerPriceTrackerPage reports={[]} isLoading={false} dashboardObservations={[]} dashboardLoading={false} saveBackfill={async (data) => {
      saved.push(data);
      return true;
    }} />);

    fireEvent.click(screen.getByTestId('button-toggle-backfill'));
    assert.ok(screen.getByTestId('form-flower-price-backfill'));
    fireEvent.change(screen.getByTestId('input-backfill-flower'), { target: { value: 'Waratah' } });
    fireEvent.change(screen.getByTestId('input-backfill-date'), { target: { value: '2025-08-10' } });
    fireEvent.change(screen.getByTestId('input-backfill-supplier'), { target: { value: 'Old Receipt Supplier' } });
    fireEvent.change(screen.getByTestId('input-backfill-bunches'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('input-backfill-cost'), { target: { value: '24' } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('form-flower-price-backfill'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0], {
      purchaseDate: '2025-08-10',
      flower: 'Waratah',
      category: 'Classic Blooms',
      supplier: 'Old Receipt Supplier',
      bunchSize: 10,
      bunchesPurchased: 2,
      pricePerBunch: 24,
    });
    assert.match(screen.getByTestId('form-flower-price-backfill').textContent ?? '', /Historical purchase added/);
  });
});
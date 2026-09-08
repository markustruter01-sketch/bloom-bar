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
  File: dom.File,
  getComputedStyle: dom.getComputedStyle.bind(dom),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.navigator,
});

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const { BuyPage, BouquetsPage, ClosePage } = await import('./App');
import { getMarketCycleSummary } from './lib/market-schedule';

const nextMarket = getMarketCycleSummary(new Date('2026-09-06T12:00:00Z'));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const buyItems = [{
  id: 1,
  marketCycle: 0,
  flower: 'Lisianthus',
  detail: 'Soft bloom',
  qty: 10,
  unit: 'stems',
  lastPrice: 3.2,
  checked: false,
  category: 'Classic Blooms',
}];

const actualPurchase = {
  id: 1,
  marketCycle: 0,
  flower: 'Lisianthus',
  detail: 'Soft bloom',
  category: 'Classic Blooms',
  stems: 10,
  unitCost: 3.2,
  source: 'manual' as const,
};

describe('planning save rejection states', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps edited buy-list values visible through a failed save and retry', async () => {
    const failed = deferred<boolean>();
    const retried = deferred<boolean>();
    let attempts = 0;
    const saveActualPurchases = async () => {
      attempts += 1;
      return attempts === 1 ? failed.promise : retried.promise;
    };

    render(
      <BuyPage
        buyItems={buyItems}
        actualPurchases={[actualPurchase]}
        costs={[]}
        buyList={{
          marketCycle: 0,
          locked: true,
          reported: false,
          receiptFileName: null,
          receiptText: null,
          receiptCandidates: [],
        }}
        nextMarket={nextMarket}
        toggleBuyItem={async () => true}
        lockBuyList={async () => true}
        saveActualPurchases={saveActualPurchases}
        saveCosts={async () => true}
        reportPurchases={async () => true}
      />,
    );

    const flowerInput = screen.getAllByLabelText('Flower')[0] as HTMLInputElement;
    fireEvent.change(flowerInput, { target: { value: 'Disbud chrysanthemum' } });
    fireEvent.click(screen.getByTestId('button-save-actual-purchases'));

    failed.resolve(false);
    await waitFor(() => assert.match(screen.getByTestId('save-status-error').textContent ?? '', /still here/));
    assert.equal(flowerInput.value, 'Disbud chrysanthemum');

    fireEvent.click(screen.getByTestId('button-retry-save'));
    retried.resolve(true);
    await waitFor(() => assert.match(screen.getByTestId('save-status-saved').textContent ?? '', /Saved to the market plan/));
    assert.equal(flowerInput.value, 'Disbud chrysanthemum');
  });

  it('keeps the edited bouquet plan visible through a failed save and retry', async () => {
    const failed = deferred<boolean>();
    const retried = deferred<boolean>();
    let attempts = 0;
    const saveBouquetPlan = async () => {
      attempts += 1;
      return attempts === 1 ? failed.promise : retried.promise;
    };

    render(
      <BouquetsPage
        bouquetPlan={{ marketCycle: 0, selectedBand: 'Market', count: 12 }}
        nextMarket={nextMarket}
        saveBouquetPlan={saveBouquetPlan}
      />,
    );

    fireEvent.click(screen.getByTestId('button-price-band-generous'));
    fireEvent.click(screen.getByTestId('button-add-bouquet'));
    assert.match(screen.getByText('13 planned').textContent ?? '', /13 planned/);
    fireEvent.click(screen.getByTestId('button-save-bouquet-plan'));

    failed.resolve(false);
    await waitFor(() => screen.getByTestId('save-status-error'));
    assert.match(screen.getByText('13 planned').textContent ?? '', /13 planned/);

    fireEvent.click(screen.getByTestId('button-retry-save'));
    retried.resolve(true);
    await waitFor(() => assert.match(screen.getByTestId('save-status-saved').textContent ?? '', /Sunday bouquet plan saved/));
    assert.match(screen.getByText('13 planned').textContent ?? '', /13 planned/);
  });

  it('keeps the edited pack-down count visible through a failed save and retry', async () => {
    const failed = deferred<boolean>();
    const retried = deferred<boolean>();
    let attempts = 0;
    const saveCloseMarket = async () => {
      attempts += 1;
      return attempts === 1 ? failed.promise : retried.promise;
    };

    render(
      <ClosePage
        closeMarket={{ marketCycle: 0, counts: { Lisianthus: 2 }, sellThrough: [], closed: false }}
        actualPurchases={[actualPurchase]}
        nextMarket={nextMarket}
        saveCloseMarket={saveCloseMarket}
      />,
    );

    fireEvent.click(screen.getByTestId('button-increase-lisianthus'));
    assert.equal(screen.getByTestId('text-leftover-lisianthus').textContent, '3');
    fireEvent.click(screen.getByTestId('button-save-close'));

    failed.resolve(false);
    await waitFor(() => screen.getByTestId('save-status-error'));
    assert.equal(screen.getByTestId('text-leftover-lisianthus').textContent, '3');

    fireEvent.click(screen.getByTestId('button-retry-save'));
    retried.resolve(true);
    await waitFor(() => assert.match(screen.getByTestId('save-status-saved').textContent ?? '', /market closed/));
    assert.equal(screen.getByTestId('text-leftover-lisianthus').textContent, '3');
  });
});
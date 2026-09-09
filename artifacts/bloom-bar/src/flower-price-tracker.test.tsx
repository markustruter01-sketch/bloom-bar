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
const { FlowerPriceTracker } = await import('./App');

const priceHistory = [{
  flower: 'Lisianthus',
  category: 'Classic Blooms',
  latest: { marketCycle: 0, date: '13 Sep 2026', unitCost: 3.2 },
  previous: { marketCycle: -1, date: '30 Aug 2026', unitCost: 2.8 },
  change: 0.4,
  changePercent: 14.2857,
  history: [
    { marketCycle: 0, date: '13 Sep 2026', unitCost: 3.2 },
    { marketCycle: -1, date: '30 Aug 2026', unitCost: 2.8 },
    { marketCycle: -2, date: '16 Aug 2026', unitCost: 2.55 },
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
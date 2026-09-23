import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
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

const { act, cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { FlowerCarePage } = await import('./App');

const entries = [
  {
    id: 1,
    flower: 'Lisianthus',
    purchaseCount: 2,
    purchasedStems: 20,
    lastPurchasedCycle: 0,
    instructions: 'Re-cut the stems and keep the vase topped up.',
    sourceName: 'Care source',
    sourceUrl: 'https://example.com/lisianthus',
    sourceStatus: 'auto-sourced' as const,
    confidence: 'high' as const,
    updatedAt: '2026-09-23T00:00:00.000Z',
  },
  {
    id: 2,
    flower: 'Daisy',
    purchaseCount: 1,
    purchasedStems: 10,
    lastPurchasedCycle: -1,
    instructions: 'Remove leaves below the waterline.',
    sourceName: 'Care source',
    sourceUrl: 'https://example.com/daisy',
    sourceStatus: 'auto-sourced' as const,
    confidence: 'medium' as const,
    updatedAt: '2026-09-23T00:00:00.000Z',
  },
];

describe('Flower Care interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('filters purchased entries and expands/collapses full care notes', () => {
    render(<FlowerCarePage entries={entries} loading={false} saveEntry={async () => true} />);

    assert.equal(screen.getByTestId('text-flower-care-count').textContent, '2');
    fireEvent.change(screen.getByTestId('input-search-flower-care'), { target: { value: 'daisy' } });
    assert.equal(screen.queryByTestId('flower-care-entry-lisianthus'), null);
    assert.ok(screen.getByTestId('flower-care-entry-daisy'));

    fireEvent.change(screen.getByTestId('input-search-flower-care'), { target: { value: '' } });
    const toggle = screen.getByTestId('button-expand-flower-care-lisianthus');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(screen.queryByTestId('flower-care-details-lisianthus'), null);

    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.match(screen.getByTestId('flower-care-details-lisianthus').textContent ?? '', /Re-cut the stems/);

    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(screen.queryByTestId('flower-care-details-lisianthus'), null);
  });

  it('saves edited notes and shows the manual status', async () => {
    let saved: string | null = null;
    render(<FlowerCarePage entries={entries} loading={false} saveEntry={async (_flower, instructions) => { saved = instructions; return true; }} />);
    fireEvent.click(screen.getByTestId('button-expand-flower-care-lisianthus'));
    fireEvent.change(screen.getByTestId('textarea-flower-care-lisianthus'), { target: { value: 'My verified conditioning note.' } });
    fireEvent.click(screen.getByTestId('button-save-flower-care-lisianthus'));
    await act(async () => {});
    assert.equal(saved, 'My verified conditioning note.');
    assert.ok(screen.getByText('Saved and marked manually edited.'));
  });
});
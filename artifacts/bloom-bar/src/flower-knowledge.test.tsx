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
const { FlowerKnowledgePage } = await import('./App');

const keys = [
  'vase-and-dried-life',
  'pairing-compatibility',
  'fragrance',
  'opens-indoors',
  'symbolic-meaning',
  'dries-well',
  'sun-sensitivity',
  'water-consumption',
  'pet-safety',
] as const;

const sections = keys.map((key) => ({
  key,
  label: key === 'vase-and-dried-life' ? 'Vase life and dried life' : key,
  value: `Knowledge for ${key}`,
  subvalues: key === 'vase-and-dried-life'
    ? [
        { label: 'Vase life with flower food', value: '10–14 days' },
        { label: 'Vase life without flower food', value: '5–7 days' },
        { label: 'Dried life', value: 'Several months' },
      ]
    : [],
  sourceName: 'Research source',
  sourceUrl: 'https://example.com/source',
  sourceStatus: 'auto-sourced' as const,
  confidence: 'high' as const,
}));

const entries = [
  {
    id: 1,
    flower: 'Lisianthus',
    purchaseCount: 2,
    purchasedStems: 20,
    lastPurchasedCycle: 0,
    sections,
    sourceStatus: 'auto-sourced' as const,
    updatedAt: '2026-09-23T00:00:00.000Z',
  },
  {
    id: 2,
    flower: 'Daisy',
    purchaseCount: 1,
    purchasedStems: 10,
    lastPurchasedCycle: -1,
    sections: sections.map((section) => ({ ...section })),
    sourceStatus: 'auto-sourced' as const,
    updatedAt: '2026-09-23T00:00:00.000Z',
  },
];

describe('Flower Knowledge interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('filters purchased entries, expands, and renders all nine sections', () => {
    render(<FlowerKnowledgePage entries={entries} loading={false} saveEntry={async () => true} />);

    assert.equal(screen.getByTestId('text-flower-knowledge-count').textContent, '2');
    fireEvent.change(screen.getByTestId('input-search-flower-knowledge'), { target: { value: 'daisy' } });
    assert.equal(screen.queryByTestId('flower-knowledge-entry-lisianthus'), null);
    assert.ok(screen.getByTestId('flower-knowledge-entry-daisy'));

    fireEvent.change(screen.getByTestId('input-search-flower-knowledge'), { target: { value: '' } });
    const toggle = screen.getByTestId('button-expand-flower-knowledge-lisianthus');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(screen.getAllByTestId(/^flower-knowledge-section-lisianthus-/).length, 9);
    assert.ok(screen.getByTestId('textarea-flower-knowledge-lisianthus-vase-and-dried-life-vase-life-with-flower-food'));

    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(screen.queryByTestId('flower-knowledge-details-lisianthus'), null);
  });

  it('saves an edited value while keeping the full section payload', async () => {
    let savedFlower = '';
    let savedSections: typeof sections | undefined;
    render(<FlowerKnowledgePage entries={entries} loading={false} saveEntry={async (flower, nextSections) => {
      savedFlower = flower;
      savedSections = nextSections as typeof sections;
      return true;
    }} />);

    fireEvent.click(screen.getByTestId('button-expand-flower-knowledge-lisianthus'));
    fireEvent.change(screen.getByTestId('textarea-flower-knowledge-lisianthus-fragrance'), { target: { value: 'Verified: barely fragrant.' } });
    fireEvent.click(screen.getByTestId('button-save-flower-knowledge-lisianthus'));
    await act(async () => {});

    assert.equal(savedFlower, 'Lisianthus');
    assert.equal(savedSections?.length, 9);
    assert.equal(savedSections?.find((section) => section.key === 'fragrance')?.value, 'Verified: barely fragrant.');
    assert.ok(screen.getByText('Saved and marked manually edited.'));
  });
});
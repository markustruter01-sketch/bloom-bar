import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BunchPurchaseInput } from '@workspace/api-client-react';

import { applyReceiptCandidates, parseReceiptCandidates } from './App';

const buyItems = [
  {
    id: 1,
    marketCycle: 0,
    flower: 'Lisianthus',
    detail: 'Soft bloom',
    qty: 2,
    unit: 'bunches',
    lastPrice: 18.5,
    checked: false,
    category: 'Classic Blooms' as const,
    priceSource: { kind: 'fallback' as const, marketCycle: null, date: null },
  },
  {
    id: 2,
    marketCycle: 0,
    flower: 'Disbud chrysanthemum',
    detail: 'Apricot statement bloom',
    qty: 1,
    unit: 'bunches',
    lastPrice: 22,
    checked: false,
    category: 'Statement Blooms' as const,
    priceSource: { kind: 'fallback' as const, marketCycle: null, date: null },
  },
];

const sampleReceiptText = `REDCLIFFE FLOWERS
ITEM QTY PRICE
Lisianthus White 2 $18.50
Disbud chrysanthemum 1 $22.00
Supplier: Redcliffe Flowers
SUBTOTAL $40.50
TOTAL $40.50`;

describe('receipt analysis', () => {
  it('maps a sample receipt image OCR result into bunch prices and counts', () => {
    const candidates = parseReceiptCandidates(sampleReceiptText, buyItems);

    assert.deepEqual(
      candidates.map(({ flower, bunchesPurchased, pricePerBunch, supplier }) => ({ flower, bunchesPurchased, pricePerBunch, supplier })),
      [
        { flower: 'Lisianthus', bunchesPurchased: 2, pricePerBunch: 18.5, supplier: 'Redcliffe Flowers' },
        { flower: 'Disbud chrysanthemum', bunchesPurchased: 1, pricePerBunch: 22, supplier: 'Redcliffe Flowers' },
      ],
    );
  });

  it('does not replace a manually entered price while applying other receipt suggestions', () => {
    const drafts: BunchPurchaseInput[] = [
      {
        flower: 'Lisianthus',
        detail: 'Soft bloom',
        category: 'Classic Blooms',
        bunchSize: 10,
        bunchesPurchased: 2,
        pricePerBunch: 17,
        supplier: 'Existing supplier',
        source: 'manual',
      },
    ];
    const candidates = parseReceiptCandidates(sampleReceiptText, buyItems);
    const result = applyReceiptCandidates(drafts, candidates, buyItems, new Set([0]));

    assert.equal(result.drafts[0].pricePerBunch, 17);
    assert.equal(result.drafts[0].supplier, 'Existing supplier');
    assert.equal(result.skipped, 1);
    assert.equal(result.added, 1);
    assert.equal(result.drafts[1].flower, 'Disbud chrysanthemum');
    assert.equal(result.drafts[1].pricePerBunch, 22);
  });

  it('returns no candidates for unreadable receipt text without throwing', () => {
    assert.deepEqual(parseReceiptCandidates('blurred ink and no readable prices', buyItems), []);
  });
});
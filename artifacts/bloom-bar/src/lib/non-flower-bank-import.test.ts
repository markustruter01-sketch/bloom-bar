import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBankCsv } from './non-flower-bank-import';

describe('bank export parsing', () => {
  it('parses a realistic debit CSV and ignores credits', () => {
    const csv = [
      'Date,Description,Debit,Credit,Reference',
      '01/09/2026,"Amazon Marketplace",100.00,,AMZ-100',
      '02/09/2026,"Gift Bag Co",30.00,,GB-30',
      '03/09/2026,"Customer payment",,250.00,SALE-250',
    ].join('\n');
    assert.deepEqual(parseBankCsv(csv), [
      {
        sourceLineNumber: 2,
        transactionDate: '2026-09-01',
        merchant: 'Amazon Marketplace',
        description: 'Amazon Marketplace',
        amount: 100,
        reference: 'AMZ-100',
      },
      {
        sourceLineNumber: 3,
        transactionDate: '2026-09-02',
        merchant: 'Gift Bag Co',
        description: 'Gift Bag Co',
        amount: 30,
        reference: 'GB-30',
      },
    ]);
  });
});
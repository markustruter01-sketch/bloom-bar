import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBankCsv, parseBankStatementText } from './non-flower-bank-import';

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

  it('parses OCR text using the same debit-line shape as PDF imports', () => {
    assert.deepEqual(parseBankStatementText([
      'Date Description Debit Credit Balance',
      '01/09/2026 Officeworks 45.00 DR',
      '02/09/2026 Customer payment 250.00 CR',
      '03/09/2026 Gift Bag Co 30.00 DEBIT',
    ].join('\n')), [
      {
        sourceLineNumber: 2,
        transactionDate: '2026-09-01',
        merchant: 'Officeworks',
        description: 'Officeworks',
        amount: 45,
        reference: null,
      },
      {
        sourceLineNumber: 4,
        transactionDate: '2026-09-03',
        merchant: 'Gift Bag Co',
        description: 'Gift Bag Co',
        amount: 30,
        reference: null,
      },
    ]);
  });

  it('rejects OCR text with no readable purchase lines', () => {
    assert.throws(
      () => parseBankStatementText('This scan is too blurry to read'),
      /No purchase transactions could be read from this PDF/,
    );
  });
});
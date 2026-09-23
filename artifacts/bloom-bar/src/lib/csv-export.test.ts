import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCsv } from './csv-export';

describe('CSV export', () => {
  it('writes an Excel-compatible BOM, stable headers, and escaped cells', () => {
    const csv = buildCsv(
      ['Description', 'Amount (AUD)', 'Note'],
      [['Tissue paper, pink', 12.5, 'Supplier said "seasonal"\r\ncheck']],
    );

    assert.equal(csv, '\uFEFFDescription,Amount (AUD),Note\r\n"Tissue paper, pink",12.5,"Supplier said ""seasonal""\r\ncheck"\r\n');
    assert.ok(csv.startsWith('\uFEFFDescription,Amount (AUD),Note\r\n'));
    assert.equal((csv.match(/\r\n/g) ?? []).length, 3);
  });

  it('keeps blank optional values as empty CSV cells', () => {
    assert.equal(buildCsv(['A', 'B', 'C'], [['value', null, undefined]]), '\uFEFFA,B,C\r\nvalue,,\r\n');
  });
});
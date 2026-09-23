import type { NonFlowerBankImportLineInput } from '@workspace/api-client-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export type ParsedBankLine = NonFlowerBankImportLineInput;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function parseAmount(value: string) {
  const normalized = value.replace(/[$£€,\s]/g, '').trim();
  if (!normalized) return null;
  const negative = normalized.startsWith('(') && normalized.endsWith(')');
  const number = Number(normalized.replace(/[()]/g, ''));
  return Number.isFinite(number) ? (negative ? -number : number) : null;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  const dayFirst = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dayFirst) {
    const year = dayFirst[3].length === 2 ? `20${dayFirst[3]}` : dayFirst[3];
    return `${year}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  }
  const yearFirst = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirst) {
    return `${yearFirst[1]}-${yearFirst[2].padStart(2, '0')}-${yearFirst[3].padStart(2, '0')}`;
  }
  return trimmed || null;
}

function findColumn(headers: string[], names: string[]) {
  const normalizedNames = names.map(normalizeHeader);
  return headers.findIndex((header) => normalizedNames.includes(normalizeHeader(header)));
}

export function parseBankCsv(input: string): ParsedBankLine[] {
  const rows = parseCsvRows(input);
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one transaction.');
  const headers = rows[0];
  const dateColumn = findColumn(headers, ['date', 'transactiondate', 'valuedate', 'postingdate']);
  const merchantColumn = findColumn(headers, ['merchant', 'payee', 'name', 'description', 'details', 'narrative']);
  const descriptionColumn = findColumn(headers, ['description', 'details', 'narrative', 'transactiondescription']);
  const referenceColumn = findColumn(headers, ['reference', 'referencenumber', 'memo']);
  const amountColumn = findColumn(headers, ['amount', 'transactionamount', 'value']);
  const debitColumn = findColumn(headers, ['debit', 'withdrawal', 'withdrawals', 'paidout', 'moneyout']);
  const creditColumn = findColumn(headers, ['credit', 'deposit', 'deposits', 'paidin', 'moneyin']);
  if (merchantColumn < 0 || (amountColumn < 0 && debitColumn < 0)) {
    throw new Error('The CSV needs a description or merchant column and an amount or debit column.');
  }

  const lines: ParsedBankLine[] = [];
  rows.slice(1).forEach((row, index) => {
    const debit = debitColumn >= 0 ? parseAmount(row[debitColumn] ?? '') : null;
    const credit = creditColumn >= 0 ? parseAmount(row[creditColumn] ?? '') : null;
    const amount = amountColumn >= 0 ? parseAmount(row[amountColumn] ?? '') : null;
    let purchaseAmount: number | null = null;
    if (debit !== null && debit !== 0) {
      purchaseAmount = Math.abs(debit);
    } else if (creditColumn < 0 && amount !== null && amount !== 0) {
      purchaseAmount = Math.abs(amount);
    } else if (debitColumn < 0 && creditColumn < 0 && amount !== null && amount !== 0) {
      purchaseAmount = Math.abs(amount);
    }
    if (purchaseAmount === null) return;
    const merchant = (row[merchantColumn] ?? '').trim();
    const description = (row[descriptionColumn >= 0 ? descriptionColumn : merchantColumn] ?? merchant).trim();
    if (!merchant && !description) return;
    lines.push({
      sourceLineNumber: index + 2,
      transactionDate: dateColumn >= 0 ? normalizeDate(row[dateColumn] ?? '') : null,
      merchant: merchant || description,
      description: description || merchant,
      amount: purchaseAmount,
      reference: referenceColumn >= 0 ? (row[referenceColumn]?.trim() || null) : null,
    });
  });
  if (lines.length === 0) throw new Error('No debit or purchase transactions were found in the CSV.');
  return lines;
}

function pdfRows(items: unknown[]) {
  const rows = new Map<number, string[]>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue;
    const value = item as { str?: unknown; transform?: unknown };
    if (typeof value.str !== 'string' || !value.str.trim()) continue;
    const transform = Array.isArray(value.transform) ? value.transform : [];
    const y = typeof transform[5] === 'number' ? Math.round(transform[5]) : 0;
    const current = rows.get(y) ?? [];
    current.push(value.str.trim());
    rows.set(y, current);
  }
  return [...rows.entries()]
    .sort(([first], [second]) => second - first)
    .map(([, values]) => values.join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export async function parseBankPdf(input: ArrayBuffer): Promise<ParsedBankLine[]> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(input),
    disableWorker: true,
  } as Parameters<typeof pdfjsLib.getDocument>[0] & { disableWorker: boolean }).promise;
  const lines: ParsedBankLine[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const row of pdfRows(content.items)) {
      if (/^(opening|closing|available|running|account|date|description|transaction|total|balance)/i.test(row)) continue;
      const amountMatch = row.match(/(?:^|\s)([$£€]?\s*\(?\d[\d,]*(?:\.\d{2})\)?)(?:\s*(?:DR|DEBIT))?\s*$/i);
      if (!amountMatch || amountMatch.index === undefined) continue;
      const amount = parseAmount(amountMatch[1]);
      if (amount === null || amount === 0) continue;
      const prefix = row.slice(0, amountMatch.index).trim();
      if (!prefix) continue;
      const dateMatch = prefix.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s+(.+)$/);
      const description = (dateMatch?.[2] ?? prefix).trim();
      lines.push({
        sourceLineNumber: lines.length + 1,
        transactionDate: dateMatch ? normalizeDate(dateMatch[1]) : null,
        merchant: description,
        description,
        amount: Math.abs(amount),
        reference: null,
      });
    }
  }
  if (lines.length === 0) throw new Error('No purchase transactions could be read from this PDF. Try a text-based bank export.');
  return lines;
}

export async function sha256Fingerprint(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
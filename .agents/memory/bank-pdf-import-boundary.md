---
name: Bank PDF import boundary
description: The supported PDF bank-export shape and the browser-side OCR fallback boundary.
---

The bank import flow should parse selectable-text PDFs first and fall back to browser-side OCR for image-only pages. Only fully parsed, validated lines should be sent to the API.

**Why:** Browser-side parsing keeps the uploaded statement out of storage and preserves the existing duplicate fingerprint, detail breakdown, and reconciliation flow. OCR can be slower and less certain, so an unreadable result must fail before the API call rather than create partial records.

**How to apply:** Keep fingerprinting, parsed-line validation, duplicate protection, and detail reconciliation format-agnostic. Run OCR only when text extraction produces no purchase lines, and surface a clear no-import error when OCR cannot produce any debit lines.
---
name: Bank PDF import boundary
description: The supported PDF bank-export shape and the reason OCR remains a separate follow-up.
---

The bank import flow should treat selectable-text PDFs as the supported baseline and reject image-only PDFs with a clear user-facing message until OCR is added.

**Why:** Browser-side text extraction can reliably preserve dates, merchant text, and amounts without retaining the uploaded file, while image-only statements require a separate OCR pipeline with different accuracy and privacy considerations.

**How to apply:** Keep fingerprinting, parsed-line validation, duplicate protection, and detail reconciliation format-agnostic. Add OCR only as a parser fallback for PDFs that produce no text rows.
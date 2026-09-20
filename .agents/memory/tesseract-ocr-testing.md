---
name: Tesseract OCR testing
description: Local OCR smoke tests need isolated working-directory handling because language data can be downloaded beside the command.
---

Run OCR smoke tests from a temporary directory or clean up downloaded language data afterward. Browser OCR uses the packaged worker flow, while direct Node tests can create a local `eng.traineddata` artifact.

**Why:** A sample receipt OCR check downloaded the English language file into the frontend workspace instead of leaving only the intended fixture and test changes.

**How to apply:** Keep OCR fixtures and parser tests in source control, but run direct worker checks from `/tmp` or remove generated language files before finishing.
---
name: Persisted JSON backfills
description: How to evolve persisted JSON fields while keeping existing records valid for stricter API schemas.
---

When a persisted JSON model gains required response fields, normalize older rows at the read boundary and persist the repaired shape while preserving all existing values and source metadata.

**Why:** Existing rows can predate the stricter schema, and validating them before normalization can turn a harmless rollout into a runtime 500.

**How to apply:** Merge stored sections by stable keys with the current seeded shape, fill only structurally missing defaults, and update the row only when the normalized JSON differs.
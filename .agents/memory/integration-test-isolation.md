---
name: Integration test isolation
description: How to keep market integration tests reliable when the development database contains real user data
---

Market integration tests should scope assertions to the cycles or flowers created by the test instead of assuming the development database is empty. Existing reported market rows can legitimately appear in global history endpoints and affect “latest” fallback behavior.

**Why:** The development database is shared with the running Bloom Bar preview, so global history endpoints may include real records outside the synthetic test cycles.

**How to apply:** Preserve user data, create unique test records, and filter global response assertions to the test-owned records. Only assert fallback behavior when the test setup controls the full relevant history.
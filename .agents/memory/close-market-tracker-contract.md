---
name: Close-market tracker contract
description: Contract rules for linking finalized pack-down data to reported purchase history and tracker guidance.
---

Only finalized close records contribute sell-through guidance; tracker and dashboard observations should carry nullable market linkage and notes so historical backfills remain valid.

**Why:** The tracker combines two independently saved flows, and backfill observations have no market cycle. Making those nullable fields explicit prevents response validation failures while keeping contextual notes out of averages.

**How to apply:** When extending the tracker response, populate marketCycle, sellThrough, and marketNotes for reported observations and explicitly return null for backfills. Keep guidance calculations based only on finalized sell-through percentages.
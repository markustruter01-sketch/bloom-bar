---
name: Drizzle development schema push prompts
description: Drizzle schema application can require an interactive decision when replacing or renaming existing columns.
---

When a Drizzle schema replaces existing PostgreSQL columns, the noninteractive development push path may stop for a rename/conflict prompt even when the command includes `--force`.

**Why:** Blindly treating a rename as a drop-and-add can lose data, while the managed production path must preserve its own rename confirmation and must not be replaced with runtime or deploy-time DDL.

**How to apply:** Inspect the development table and row count first. If development is empty, apply only the verified development-side schema change through the approved database workflow or controlled development SQL, then verify the resulting columns. Leave production schema changes to the Replit Publish flow.
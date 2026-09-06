---
name: OpenAPI integer compatibility
description: Generated Zod clients currently target a Zod 3 runtime in this workspace.
---

Use numeric OpenAPI transport fields instead of `integer` when regenerating clients in this workspace, and enforce integer-only semantics at the server boundary with explicit validation.

**Why:** The installed Zod 3 runtime does not expose the `z.int()` helper emitted by the current Orval configuration for OpenAPI integer fields, so code generation succeeds but the generated library typecheck fails.

**How to apply:** Before adding integer fields to `lib/api-spec/openapi.yaml`, confirm the generator/runtime pairing; if it is unchanged, use numeric schemas and validate integer constraints in the API route.
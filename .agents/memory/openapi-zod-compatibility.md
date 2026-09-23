---
name: OpenAPI integer compatibility
description: Generated Zod clients currently target a Zod 3 runtime in this workspace.
---

Use numeric OpenAPI transport fields instead of `integer`, and plain strings instead of `format: uri`, when regenerating clients in this workspace. Enforce integer-only or URL semantics at the server boundary with explicit validation.

**Why:** The installed Zod 3 runtime does not expose the `z.int()` or `z.url()` helpers emitted by the current Orval configuration for OpenAPI integer and URI fields, so code generation can succeed while the generated library typecheck fails.

**How to apply:** Before adding integer or URI formats to `lib/api-spec/openapi.yaml`, confirm the generator/runtime pairing; if it is unchanged, use numeric/string schemas and validate the stricter constraints in the API route.
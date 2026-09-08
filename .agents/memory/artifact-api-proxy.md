---
name: Artifact API proxy
description: The local preview topology used by the Bloom Bar web and API artifacts.
---

The Bloom Bar web artifact runs on its own Vite port while the API server runs on port 8080, so the Vite dev server must proxy `/api` requests to `http://127.0.0.1:8080`.

**Why:** A direct artifact preview otherwise serves the Vite HTML fallback for API paths. The app can render with stale or empty cached context and hide the real API connection problem.

**How to apply:** Keep the `/api` proxy in the Bloom Bar Vite server configuration and restart the web workflow after changing it.
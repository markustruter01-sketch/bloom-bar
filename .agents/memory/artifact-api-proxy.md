---
name: Artifact API proxy
description: The local preview topology used by the Bloom Bar web and API artifacts.
---

The Bloom Bar web artifact runs on its own Vite port while the API server runs on port 8080, so the Vite dev server must proxy `/api` requests to `http://127.0.0.1:8080`.

**Why:** A direct artifact preview otherwise serves the Vite HTML fallback for API paths. The app can render with stale or empty cached context and hide the real API connection problem.

**How to apply:** Keep the `/api` proxy in the Bloom Bar Vite server configuration and restart the web workflow after changing it.

The web workflow may expose a dynamically assigned Vite port instead of 5000; use the workflow’s current open port when taking a direct preview snapshot.

**Why:** The default preview port can refuse connections even while the web workflow is running normally.

**How to apply:** Check the running workflow output for the current Vite port before using a direct local screenshot or curl.
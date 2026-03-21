# Playwright regression suite

## Folder structure

- `tests/ui` — end-to-end UI regression flows.
- `tests/api` — API contract and workflow tests.
- `tests/helpers` — reusable helpers (`login`, `create case`, `api client`).
- `tests/fixtures` — seed and mock data plus mock route registration.
- `tests/utils` — cross-cutting assertions and utility functions.
- `tests/reporters` — custom execution reporter for CI/local summaries.

## Environment variables

- `PLAYWRIGHT_BASE_URL` — frontend URL, default `http://127.0.0.1:3000`
- `PLAYWRIGHT_API_BASE_URL` — API base URL, default `http://127.0.0.1:8001/api`
- `PLAYWRIGHT_BACKEND_URL` — optional backend base URL fallback
- `PLAYWRIGHT_USE_MOCKS` — `true` by default for deterministic tests
- `PLAYWRIGHT_START_WEB_SERVER` — set to `true` to launch the frontend automatically
- `CI` — enables CI-oriented retries and worker settings

## Running

```bash
npm install
npm run test:install
npm run test
```

The suite is mock-first so it can run independently on every commit, but the reusable helpers also support live API execution when `PLAYWRIGHT_USE_MOCKS=false`.

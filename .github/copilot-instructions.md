## Repo snapshot for AI coding assistants

This file gives focused, actionable guidance for an AI coding agent to be immediately productive in this repository.

1. Purpose

- This is the Community Resources Guide (CRG) Houston— a React app that serves searchable community assistance data and generates emails/PDFs for clients. See the high-level overview in [CLAUDE.md](../CLAUDE.md).

2. High-level architecture & key files

- Frontend: Create React App under `src/` with main shell at [src/MainApp.js](src/MainApp.js#L1) and entry [src/App.js](src/App.js#L1).
- Data access: centralized in [src/services/dataService.js](src/services/dataService.js#L1) and consumed by the hook in [src/data/FetchDataSupabase.js](src/data/FetchDataSupabase.js#L1).
- Authentication: organization passcodes handled in [src/auth/Login.js](src/auth/Login.js#L1); permissions flow from the `registered_organizations` Supabase table.
- Serverless functions: Cloudflare Pages functions in `functions/` (examples: `createPdf.js`, `sendEmail.js`). Use these when implementing or testing backend logic.

3. Data & conventions

- Data access pattern: prefer `dataService` methods rather than ad-hoc Supabase calls in components. Example consumers: chart container components in `src/components/charts/containers/`.
- UI strings are inline in components (no translation layer).

4. Developer workflows & commands

- Frontend dev: `npm start` (Create React App dev server at http://localhost:3000).
- Tests: `npm test` (Jest, watch mode)
- Build: `npm run build` → outputs `build/`.
- Serverless/local functions: use Cloudflare Pages local dev for functions (`npx wrangler pages dev build --port 8788`)—this serves function routes like `/createPdf` for testing.

5. Patterns & pitfalls to follow

- Use `dataService` for queries; it centralizes behavior and table names. When adding DB access, add a method to `src/services/dataService.js` and update consumers.
- UI formatting: app uses Tailwind CSS and some custom fonts—follow existing utility classes in `src/` components.
- Serverless behavior: `createPdf` and email functions are used by the frontend via fetch/curl; keep payload shapes stable and check existing callers (search for `/createPdf` or callsites in `src/`).

6. Integration points to check before changes

- Supabase client exported/used from `src/MainApp.js`—changes to initialization affect many consumers.
- `registered_organizations` controls auth and defaults—editing auth surfaces requires coordination with database schema.
- All data is fetched from Supabase at runtime; there are no static JSON data files.

7. Example quick tasks (how to proceed safely)

- Add a new dataService call: add method in [src/services/dataService.js](src/services/dataService.js#L1), update the hook or container that needs it.
- Change PDF payloads: update `functions/createPdf.js` and test locally with the Pages functions runner used in this repo.

8. What not to change lightly

- Avoid altering the auth flow in `src/auth/Login.js` without running end-to-end checks.

9. Where to look first for context

- [CLAUDE.md](../CLAUDE.md) — high-level overview
- [src/services/dataService.js](src/services/dataService.js#L1) — data access patterns
- [src/data/FetchDataSupabase.js](src/data/FetchDataSupabase.js#L1) — how the app fetches and hydrates data
- `functions/createPdf.js` — example of serverless endpoint used by the frontend

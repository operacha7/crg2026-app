## Repo snapshot for AI coding assistants

This file gives focused, actionable guidance for an AI coding agent to be immediately productive in this repository.

1. Purpose

- This is the Community Resources Guide (CRG) Houston— a bilingual React app that serves searchable community assistance data and generates emails/PDFs for clients. See the high-level overview in [CLAUDE.md](CLAUDE.md#L1).

2. High-level architecture & key files

- Frontend: Create React App under `src/` with main shell at [src/MainApp.js](src/MainApp.js#L1) and entry [src/App.js](src/App.js#L1).
- Data access: centralized in [src/services/dataService.js](src/services/dataService.js#L1) and consumed by the hook in [src/data/FetchDataSupabase.js](src/data/FetchDataSupabase.js#L1).
- Language & UI: bilingual state in [src/Contexts/LanguageContext.js](src/Contexts/LanguageContext.js#L1) and translations via [src/Utility/Translate.js](src/Utility/Translate.js#L1) (not i18n files).
- Authentication: organization passcodes handled in [src/auth/Login.js](src/auth/Login.js#L1); permissions and language defaults flow from the `registered_organizations` Supabase table.
- Serverless functions: two folders mirror functionality—`functions/` and `netlify/functions/` (examples: `createPdf.js`, `sendEmail.js`). Use these when implementing or testing backend logic.

3. Data & conventions

- Bilingual data: English/Spanish are stored in parallel tables/files (e.g., `resources_en` / `resources_es`, and public data files like `public/data/Table3EN.json`).
- UI strings: use `Translate.js` and `LanguageContext`—do not introduce a new i18n system without migrating the rest of the app.
- Data access pattern: prefer `dataService` methods rather than ad-hoc Supabase calls in components. Example consumers: chart container components in `src/components/charts/containers/`.

4. Developer workflows & commands

- Frontend dev: `npm start` (Create React App dev server at http://localhost:3000).
- Tests: `npm test` (Jest, watch mode)
- Build: `npm run build` → outputs `build/`.
- Storybook: `npm run storybook` (storybook runs at :6006).
- Serverless/local functions: the maintainer uses Cloudflare Pages local dev for functions (`npx wrangler pages dev build --port 8788`)—this serves function routes like `/createPdf` for testing. If editing `functions/createPdf.js`, test with the Pages functions runner or your platform's emulator.

5. Patterns & pitfalls to follow

- Preserve bilingual flows: when adding fields or UI labels, mirror support for both languages and update `Translate.js` and `LanguageContext` consumers.
- Use `dataService` for queries; it centralizes behavior and table names. When adding DB access, add a method to `src/services/dataService.js` and update consumers.
- UI formatting: app uses Tailwind CSS and some custom fonts—follow existing utility classes in `src/` components.
- Serverless behavior: `createPdf` and email functions are used by the frontend via fetch/curl; keep payload shapes stable and check existing callers (search for `/createPdf` or callsites in `src/`).

6. Integration points to check before changes

- Supabase client exported/used from `src/MainApp.js`—changes to initialization affect many consumers.
- `registered_organizations` controls auth and defaults—editing auth surfaces requires coordination with database schema.
- Public data copies: `public/data/` contains generated JSON used by builds; update generation scripts in `scripts/` when changing source exports.

7. Example quick tasks (how to proceed safely)

- Add a new dataService call: add method in [src/services/dataService.js](src/services/dataService.js#L1), update the hook or container that needs it, and add a small unit test or story where applicable.
- Change PDF payloads: update `functions/createPdf.js` and test locally with the Pages functions runner used in this repo.

8. What not to change lightly

- Do not replace `Translate.js` or `LanguageContext` with a new i18n library without a migration plan.
- Avoid altering the auth flow in `src/auth/Login.js` without running end-to-end checks—organization passcodes and language defaults are tightly coupled.

9. Where to look first for context

- [CLAUDE.md](CLAUDE.md#L1) — high-level overview
- [src/services/dataService.js](src/services/dataService.js#L1) — data access patterns
- [src/data/FetchDataSupabase.js](src/data/FetchDataSupabase.js#L1) — how the app fetches and hydrates data
- `functions/createPdf.js` and `netlify/functions/createPdf.js` — examples of serverless endpoints used by the frontend

If any section is unclear or you'd like more examples (component-level recipes, specific query patterns from `dataService`, or function invocation examples), tell me which area and I will expand with concrete snippets and tests.

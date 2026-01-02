# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Community Resources Guide (CRG) Houston - a bilingual (English/Spanish) React application that helps organizations find and share community assistance resources. Users log in via organization passcodes and can search for resources by zip code, organization, or assistance type, then email or PDF selected results to clients.

## Commands

```bash
npm start          # Development server at localhost:3000
npm run build      # Production build to /build
npm test           # Jest test runner (interactive watch mode)
npm run storybook  # Storybook at localhost:6006
```

## Architecture

### Data Flow
- **Supabase Backend**: All data fetched from Supabase (`MainApp.js` exports the `supabase` client)
- **dataService** (`src/services/dataService.js`): Centralized data access layer with methods for all tables (resources, zip codes, organizations, assistance types, neighborhoods)
- **useFetchCRGData** hook (`src/data/FetchDataSupabase.js`): Primary data fetching hook used in `AppContent`, reacts to language changes

### Bilingual Support
- Language state managed by `LanguageContext` - determines organization's default language on login
- **Separate database tables** for English/Spanish content: `resources_en`/`resources_es`, `assistance_types_en`/`assistance_types_es`
- UI translations in `src/Utility/Translate.js` via `uiTranslations` object (NOT i18n files)

### Key Components Structure
```
src/
├── MainApp.js           # Main app shell, routing, Supabase client export
├── App.js               # Root with login state, UTM preservation
├── auth/Login.js        # Organization/passcode authentication
├── Contexts/
│   ├── LanguageContext.js    # Bilingual state (English/Español)
│   ├── StatisticsContext.js  # Shared state for reports/charts
│   └── TourProvider.js       # Guided tour state
├── views/               # Page-level components
├── components/
│   └── charts/          # Recharts-based analytics
│       ├── containers/  # Data-fetching chart wrappers
│       └── shared/      # Reusable chart layouts
├── layout/
│   ├── PageLayout.js    # Shared layout with header/footer/language toggle
│   └── NavBar.js
└── services/dataService.js  # Supabase query methods
```

### Authentication
- Organizations authenticate with passcodes stored in `registered_organizations` table
- User object passed as `loggedInUser` prop throughout the app
- Controls email/PDF permissions and default language

### Main Routes
- `/` - ZipCodePage (main search by zip)
- `/organization` - OrganizationPage (search by org)
- `/search` - GeneralSearchPage (multi-criteria search)
- `/reports` - StatisticsPage (usage analytics)
- `/messages` - MessagesPage (system announcements)

## Supabase Tables
- `resources_en`, `resources_es` - Main resource data
- `zip_codes` - Houston area zip codes with coordinates
- `assistance_types_en`, `assistance_types_es` - Assistance categories
- `registered_organizations` - Organization credentials and settings
- `organizations` - Organization metadata
- `neighborhoods` - Neighborhood data
- `app_usage_logs` - Analytics data

## Styling
- Tailwind CSS for utility classes
- Custom fonts: Lexend (body), Comfortaa (headers), Open Sans
- Primary brand colors: `#4A4E69` (header), `#FFC857` (gold accent), `#002D62` (navy)

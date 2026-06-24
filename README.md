# e2e-testora

> End-to-end testing orchestration and runner built with Next.js, Drizzle, and a lightweight test-engine.

## Table of Contents
- **Overview**: Short project description and goals.
- **Tech Stack**: Key technologies used.
- **Quick Start**: Install, configure, and run locally.
- **Database**: Migrations and seeding instructions.
- **Development**: Common developer commands.
- **API & Architecture**: Where code lives and how it works.
- **Contributing**: How to help.
- **Troubleshooting**: Common issues and fixes.

## Overview

`e2e-testora` is an end-to-end testing orchestration app that provides:
- a web UI (Next.js) to manage test suites, fixtures, and runs
- API routes for creating and running tests programmatically
- a small test-engine for generating and executing test scenarios

The project is intended for local development and CI integration to run deterministic E2E tests.

## Tech Stack
- **Framework**: `Next.js` (app router)
- **Language**: `TypeScript`
- **Styling**: `Tailwind CSS`
- **DB / ORM**: `Drizzle` (see `db/`)
- **Package manager**: `pnpm`
- **Runtime / Tools**: Node.js, `pnpm` scripts, and Docker (optional)

## Prerequisites
- Node.js (v16+ recommended)
- `pnpm` installed globally
- A working SQL database (the project uses the `db/` folder and Drizzle migration scripts)

## Quick Start

1. Clone the repo:

```bash
git clone <repo-url> e2e-testora
cd e2e-testora
```

2. Install dependencies:

```bash
pnpm install
```

3. Create environment variables
- Copy an `.env.example` to `.env` and fill values (if the repo includes one). If not present, ensure `DATABASE_URL` points to your SQL database and any required secrets are set.

4. Database setup
- Run migrations and seed the database. There are helper scripts in `db/`.

```bash
# If project provides scripts:
pnpm run db:migrate || node db/migrate.ts
pnpm run db:seed || node db/seed.ts
```

5. Start the dev server:

```bash
pnpm dev
# or
pnpm run dev
```

Open http://localhost:3000 in your browser.

## Development Commands
- **Install deps**: `pnpm install`
- **Dev server**: `pnpm dev` or `pnpm run dev`
- **Build**: `pnpm build` or `pnpm run build`
- **Start**: `pnpm start` or `pnpm run start`
- **Seed DB**: `pnpm run db:seed` (observed in repo)

If a script is not present in `package.json`, run the underlying script files in `db/` directly (e.g., `node db/seed.ts`). See [package.json](package.json) for available scripts.

## Database
- Migrations and helpers live in the `db/` folder: see [db/migrate.ts](db/migrate.ts) and [db/seed.ts](db/seed.ts).
- The codebase uses Drizzle; ensure `DATABASE_URL` points to your DB for migrations and runtime.

## API & Architecture
- API routes live under `src/app/api/` (example: [src/app/api/cases/route.ts](src/app/api/cases/route.ts) and [src/app/api/run/route.ts](src/app/api/run/route.ts)).
- UI pages and components are in `src/app/` and `src/components/`.
- The test engine and generators are under `test-engine/` — look at `test-engine/run.ts` and `test-engine/executors/` for execution flow.

High-level flow:
1. Create fixtures / suites via the UI or the API
2. Trigger a run via the API or UI
3. The test-engine executes scenarios and returns structured results
4. Results are persisted to the database and viewable in the UI

## Useful File References
- `package.json`: project scripts and deps — [package.json](package.json)
- DB helpers: [db/migrate.ts](db/migrate.ts), [db/seed.ts](db/seed.ts)
- API samples: [src/app/api/cases/route.ts](src/app/api/cases/route.ts), [src/app/api/run/route.ts](src/app/api/run/route.ts)
- UI entry: [src/app/page.tsx](src/app/page.tsx), layout: [src/app/layout.tsx](src/app/layout.tsx)

## Testing

The repository includes a `test-engine/` directory with generators and executors. Running end-to-end scenarios can be done through the UI or by POSTing to the run API endpoints.

Automated tests (unit / integration) are not included by default — add your preferred test runner (Vitest, Jest, Playwright) and create CI steps as needed.

## Contributing
- Fork the repo, create a feature branch, and open a PR describing your change.
- Run `pnpm install` and the dev server locally to validate UI/workflows.

## Troubleshooting
- Dev server fails to start: ensure Node version and `pnpm` are correct and `DATABASE_URL` is set.
- DB migration/seed errors: confirm DB is reachable and has correct privileges.
- If you see TypeScript or build errors, run `pnpm build` locally to reproduce.

## Deployment
- This is a standard Next.js app — you can deploy to Vercel, or build and run with `pnpm build` then `pnpm start`.
- If you use Docker, see `docker-compose.yml` for local service composition.

## License & Credits
- This project uses common OSS tools: Next.js, Tailwind CSS, Drizzle, and `pnpm`.
- Released under the [MIT License](LICENSE) — you're free to use, modify, and distribute it,
  including commercially. The software is provided **"as is"**, without warranty of any kind; the
  author accepts no liability for any damage, data loss, or other problems arising from its use.

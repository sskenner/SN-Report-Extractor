# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: ServiceNow Report Tool

React + Vite SPA (`@workspace/sn-report-tool`) + Express API server (`@workspace/api-server`).

### Features

#### Report Configuration Management (`/reports`)
- CRUD for named report configs: name, sys_id (32-char hex), filter query, fields
- Verify button: hits `POST /api/reports/:id/verify` → looks up `sys_report` in ServiceNow, stores `verifiedTitle` + `verifiedTable`
- Two default reports seeded on startup if table is empty (from `artifacts/api-server/src/lib/seed.ts`)

#### Report Execution & CSV Export
- **Run button** (shown in expanded row panel, only enabled when `verifiedTable` is set):
  - Calls `POST /api/reports/:id/run` (native `fetch`, not React Query — returns `text/csv` or JSON error)
  - Live progress log displayed during fetch (polls `GET /api/reports/:id/runs/latest` every 1.5s)
  - On completion, auto-downloads timestamped CSV: `{title}_{YYYY-MM-DD_HH-MM-SS}.csv`
  - Errors shown inline with full message
- **Run history** (toggleable panel per report): `GET /api/reports/:id/runs` — shows date, record count, duration, status

#### Backend Pagination Logic (`artifacts/api-server/src/routes/run.ts`)
- `POST /api/reports/:id/run`: paginates ServiceNow Table API (100 records/page, 60s per-page timeout)
  - Uses `sysparm_display_value=true`, `sysparm_exclude_reference_link=true`
  - Updates `report_runs.record_count` after each page (enables live progress polling)
  - Creates run record (status=running), updates to success/error on completion
  - Returns RFC 4180 CSV with `Content-Disposition: attachment; filename=...`
- `GET /api/reports/:id/runs` — list all runs for a report, newest first
- `GET /api/reports/:id/runs/latest` — most recent run (used for progress polling)

### Database Tables
- `report_configs`: id, name, sys_id, filter_query, fields, verified_title, verified_table, verified_at, created_at, updated_at
- `report_runs`: id, report_config_id (FK → report_configs, cascade delete), report_name, started_at, completed_at, record_count, status (running/success/error), error_message

### API Endpoints
- `GET /api/healthz`
- `GET /api/servicenow/config`
- `GET /api/servicenow/ping`
- `GET /api/reports`
- `POST /api/reports`
- `PUT /api/reports/:id`
- `DELETE /api/reports/:id`
- `POST /api/reports/:id/verify`
- `POST /api/reports/:id/run` → returns `text/csv`
- `GET /api/reports/:id/runs`
- `GET /api/reports/:id/runs/latest`

#### Test Data Generator (`/test-data`)
- Count input (1–2000, default 2000) with prominent warning about live PDI
- Async generation: POST /api/test-data/generate returns 202, runs in background
- Frontend polls GET /api/test-data/status every 1s while running
- Progress bar + live elapsed timer + 3-column summary (Created / Failed / Duration)
- Per-record failures logged but don't abort the run (matches Python script behavior)
- Falls back from SN_ADMIN_USERNAME/SN_ADMIN_PASSWORD to SN_USERNAME/SN_PASSWORD

### Environment Secrets Required
- `SN_INSTANCE` — ServiceNow instance URL (e.g. `https://dev12345.service-now.com`)
- `SN_USERNAME` — API user
- `SN_PASSWORD` — API password
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)

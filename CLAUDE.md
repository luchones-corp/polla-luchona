# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**La Polla — Mundial 2026**: A World Cup 2026 prediction pool app where friends create private groups, predict match outcomes/scores, and compete on a live leaderboard. Spanish is the primary language; English is supported via i18n.

## Commands

```bash
npm run dev          # Vite dev server with React Fast Refresh
npm run build        # TypeScript check (tsc -b) + Vite production build
npm run test         # Run vitest
npm run preview      # Preview production build locally
```

Supabase:
```bash
supabase functions deploy sync-fixtures   # Deploy Edge Function
supabase functions invoke sync-fixtures   # Manual fixture sync
supabase db push                          # Apply SQL migrations
```

## Tech Stack

- **Frontend**: React 19 + Vite 7 + TypeScript 5.8 + React Router v7
- **Backend**: Supabase (Postgres + Auth + Edge Functions + Realtime)
- **External API**: football-data.org v4 (match fixtures/scores, server-side only)
- **Styling**: Custom CSS with CSS variables (dark/light themes, no framework)
- **Deployment**: Vercel (SPA rewrite in vercel.json)
- **PWA**: Service worker + manifest for standalone install

## Architecture

### Frontend (`src/`)

- **`App.tsx`** — Root router + session management. Unauthenticated users see `AuthForm`, first-time users go through `DisplayNameGate`, then land on `DashboardPage`.
- **`pages/`** — Route-level components: `DashboardPage` (main shell), `JoinGroupPage`, `ProfilePage`, `ArchivePage`.
- **`components/`** — UI components. `DashboardPage` is the main container with 4 tabs: partidos (matches), tabla (leaderboard), grupo (group management), en-vivo (live feed).
- **`lib/api.ts`** — ~60 wrapper functions around Supabase `.from()`, `.rpc()`, and `.auth.*()`. All DB interaction goes through here.
- **`lib/types.ts`** — All TypeScript type definitions (Group, Prediction, Fixture, etc.).
- **`lib/ranking.ts`** — Leaderboard ranking with tiebreaker logic. Has tests in `lib/__tests__/ranking.test.ts`.
- **`hooks/`** — Custom hooks for Realtime subscriptions, push notifications, theme, countdown timers.
- **`contexts/LocaleContext.tsx`** — i18n provider. Translations live in `lib/translations/{es,en}.ts` (~200 keys each). Use `t('section.key')`.

State management is React hooks only (no Redux). Persistence via localStorage for preferences (theme, locale, selected group, sound). Props drilling for component trees.

### Backend (`supabase/`)

- **`sql/`** — Sequential migrations (`001` through `014`). Apply in order. Each adds tables, views, RLS policies, or RPC functions.
- **`functions/sync-fixtures/`** — Deno Edge Function that syncs match data from football-data.org into the DB.

### Scoring Rules

- **3 pts** for exact score match (both home and away scores correct)
- **1 pt** for correct outcome only (HOME/DRAW/AWAY)
- **0 pts** for wrong prediction
- **Tiebreaker**: points DESC -> exact_count DESC -> last_correct_at DESC -> name ASC
- **90-min rule**: Knockout outcomes always use 90-minute score. If `score.duration === 'REGULAR'`, use `fullTime`; otherwise use `regularTime`. Never use `score.winner` (includes extra time/penalties).

### Prediction Locking

Dual enforcement:
1. **Database RLS**: Predictions can only be inserted/updated when `kickoff_at > now()`
2. **Frontend**: `isBeforeLockTime()` checks `kickoff - lock_minutes_before` (configurable per group by owner)

The DB is the hard boundary; the frontend lock is a softer, group-configurable deadline.

### Key Database Objects

- **`group_standings` view** — Computes points, exact_count, last_correct_at per user per group. Security invoker.
- **RPC functions** — All `security_definer` with auth checks: `create_group`, `join_group_by_token`, `get_group_predictions`, `get_stage_standings`, `get_leaderboard_history`, `get_user_predictions_in_group`, `add_ghost_player`, `archive_group`, `delete_group`, etc.
- **Realtime** — Enabled on `group_messages` and `match_events` tables.
- **RLS** — On all tables. Predictions are only visible to others after match kickoff. Group data is scoped to members.

### Environment Variables

Client (Vite, prefixed `VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Server (Edge Functions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APIFOOTBALL_API_KEY`, `APIFOOTBALL_SEASON`

## Conventions

- **i18n**: All user-facing strings go through `t()`. Add keys to both `es.ts` and `en.ts`.
- **New migrations**: Add as `supabase/sql/NNN_description.sql` with the next sequential number.
- **API functions**: Add to `src/lib/api.ts` using Supabase `.from()` or `.rpc()`.
- **Fonts**: Anton (display), Archivo (headings), Hanken Grotesk (body).
- **Accent color**: `#c6ff32` (lime). Dark theme is default.
- **Dates**: Stored as UTC `timestamptz`, displayed in user's local timezone via JS `toLocaleString`.

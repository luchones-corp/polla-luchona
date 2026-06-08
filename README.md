# World Cup 2026 Prediction Pool (MVP)

Aplicación para grupos privados donde amigos predicen resultados de partidos del Mundial 2026 y compiten por puntos en un leaderboard en vivo.

## Stack

- `React` + `Vite`
- `Supabase` (Postgres + Auth + Edge Functions)
- `football-data.org v4` para fixtures/resultados (solo server-side)

## Lo implementado

- Auth email/password
- Perfil con `display_name`
- Crear grupo y autounirse como owner
- Link de invitación reusable por grupo (`invite_token`)
- Join por token (`/join/:token`)
- Fixtures con kickoff en hora local
- Predicciones `HOME | DRAW | AWAY` por usuario+partido
- Lock de predicción en DB (RLS antes de kickoff)
- Leaderboard por grupo con empates compartiendo rank
- Gestión owner: regenerar invite link y remover miembro
- Highlight top 3 cuando terminan todos los partidos
- Edge Function para sync de football-data.org v4 con outcome basado en 90 min (`score.fullTime` o `score.regularTime` según `score.duration`)

## Estructura importante

- Schema y políticas: `supabase/sql/001_init_schema.sql`
- Sync function: `supabase/functions/sync-fixtures/index.ts`
- Frontend entry: `src/App.tsx`
- Dashboard: `src/pages/DashboardPage.tsx`
- Join flow: `src/pages/JoinGroupPage.tsx`
- Test ranking: `src/lib/__tests__/ranking.test.ts`

## Variables de entorno

Cliente (`Vite`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Servidor / sync:

- `SUPABASE_SERVICE_ROLE_KEY`
- `APIFOOTBALL_API_KEY` — clave de football-data.org (header `X-Auth-Token`)
- `APIFOOTBALL_SEASON` (default: `2026`)

## Setup local

```bash
npm install
npm run dev
```

## Validación

```bash
npm run build
npm run test
```

## Supabase deploy

1. Ejecutar SQL de schema: `supabase/sql/001_init_schema.sql`.
2. Deploy de función:

```bash
supabase functions deploy sync-fixtures
```

3. Invocación manual:

```bash
supabase functions invoke sync-fixtures
```

4. Configurar cron:
- diario para refrescar fixtures
- cada 3–5 min en ventanas live

## Nota clave de scoring

En knockouts, el `outcome` se calcula con el score a 90 min: si `score.duration == "REGULAR"` se usa `score.fullTime`; si no, se usa `score.regularTime`. Nunca se usa `score.winner` (incluye extra-time/penales).

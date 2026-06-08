# sync-fixtures Edge Function

Sincroniza fixtures/equipos/resultados desde API-Football a Supabase.

## Variables de entorno

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APIFOOTBALL_API_KEY`
- `APIFOOTBALL_BASE_URL` (opcional, default `https://v3.football.api-sports.io`)
- `APIFOOTBALL_SEASON` (opcional, default `2026`)
- `APIFOOTBALL_LEAGUE_ID` (opcional, default `1`)
- `APIFOOTBALL_RAPID_HOST` (opcional, usar solo si consumes vía RapidAPI)

## Deploy

```bash
supabase functions deploy sync-fixtures
```

## Probar manualmente

```bash
supabase functions invoke sync-fixtures
```

## Cron sugerido

- Cada día: 1 vez para refrescar fixtures.
- Días de partido: cada 3-5 minutos durante ventanas live.

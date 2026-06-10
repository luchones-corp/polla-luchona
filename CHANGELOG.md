# Changelog

All notable changes to La Polla — Mundial 2026.

---

## v1.0.0 — Foundation (2026-06-01)

### Auth & Onboarding
- Email/password registration and login via Supabase Auth
- Display name setup on first login
- Session persistence across page reloads

### Groups
- Create named groups with auto-generated invite tokens
- Shareable invite links (`/join/:token`) with public group preview
- Join groups via invite link
- Owner can regenerate invite token and remove members
- Switch between multiple groups

### Match Predictions
- Browse all 104 World Cup matches with team flags, kickoff times, and status
- Predict Home / Draw / Away for each upcoming match
- Predictions lock automatically at kickoff (enforced by the database)
- Paginated match list (10 per page)

### Leaderboard
- Group standings ranked by total correct predictions
- Podium display for top 3 with medal indicators
- Current user highlighted with "TU" badge

### Design
- Dark theme with lime (#c6ff32) accent palette
- Custom typography: Anton (display), Archivo (headings), Hanken Grotesk (body)
- Responsive layout: desktop top nav, mobile bottom nav
- Animated transitions (fade-in, pop-in, button press feedback)
- Country flags via flagcdn.com

### Infrastructure
- React 19 + Vite 7 + TypeScript
- react-router-dom v7 routing
- Supabase Postgres with Row-Level Security on all tables
- Supabase Edge Function (`sync-fixtures`) pulls data from football-data.org v4
- Deployed on Vercel

---

## v1.1.0 — The Big Update (2026-06-09)

### Live Scores & Points
- Final scores (`ft_home` / `ft_away`) displayed on finished match cards
- Correct prediction highlighted with green glow and checkmark
- Incorrect prediction shown with red border
- "+1 pt" / "+0 pts" chip on resolved matches

### Countdown Timers
- "Cierra en 2d 5h" countdown on upcoming match cards
- Urgency styling when less than 2 hours remain
- Auto-refresh every 60s (every 1s under 5 minutes)

### Match Filters
- Filter by stage: Grupos / R32 / R16 / Cuartos / Semis / Final
- Filter by date: Hoy / Manana
- Filter by status: Sin prediccion / Ya predicho
- Filters reset pagination automatically

### Predict-All Flow
- "Predecir todos" button to batch-predict unpredicted matches
- Modal cycles through matches one at a time with progress bar
- Skip button and completion summary

### Group Prediction Reveal
- Expandable section on locked match cards shows group members' picks
- Correct picks highlighted in lime
- Only visible after kickoff (enforced by security-definer RPC)

### Head-to-Head Comparison
- Click any opponent in the leaderboard to compare match-by-match
- Side-by-side view of both players' picks with correct/incorrect styling
- Total correct count for each player

### Stage Mini-Leaderboards
- Filter the leaderboard by tournament stage
- Tabs: General / Grupos / R32 / R16 / Cuartos / Semis / Final
- Standings computed via `get_stage_standings` RPC

### Group Chat
- Real-time messaging within each group via Supabase Realtime
- Message bubbles with avatars (own messages right-aligned)
- Optimistic sends with rollback on error
- 500-character limit, auto-scroll to latest, message count display

### Achievements
- 7 client-side achievements with progress tracking:
  - Racha de 3 / 5 / 10 (consecutive correct predictions)
  - Fase de grupos completa (all group-stage matches predicted)
  - Perfeccionista (perfect day with 3+ matches)
  - Madrugador (predicted 24h+ before kickoff)
  - Todologo (predicted in every stage)
- Trophy icon in topbar opens achievements panel with earned/locked states

### Notifications
- Badge count on "Partidos" tab for unpredicted matches within 2 hours of kickoff

### Dark / Light Theme
- Sun/moon toggle in topbar
- Full light-mode palette via `[data-theme="light"]` CSS variables
- Preference persisted in localStorage

### PWA
- `manifest.json` with standalone display and LP brand icons (192px, 512px SVG)
- Service worker caching app shell (cache-first static, network-first API)
- Install banner when `beforeinstallprompt` fires

### Component Architecture
- Extracted 9 components from DashboardPage (Avatar, FlagImg, StatusPill, PickSelector, FixtureCard, PartidosView, TablaView, GrupoView, Icons)
- DashboardPage reduced from ~570 to ~220 lines

### Database Migrations
- `002_group_predictions.sql` — `get_group_predictions` RPC (security definer)
- `003_stage_standings.sql` — `get_stage_standings` RPC
- `004_group_messages.sql` — `group_messages` table with RLS + Realtime publication

---

## v1.2.0 — Full Feature Drop (2026-06-09)

### Exact Score Prediction + New Scoring Model
- Predict exact scores (home/away) in addition to outcome (HOME/DRAW/AWAY)
- New scoring: 3 pts for exact score, 1 pt for correct outcome only, 0 pts for wrong
- Tiebreaker rules: points DESC → exact_count DESC → last_correct_at DESC → name ASC
- ScoreInput component with numeric inputs (0-20) below PickSelector
- Auto-derives outcome from scores when both are entered
- Gold highlight and "+3 pts ★" chip on exact score hits
- Exact score count shown in leaderboard rows

### Prediction Streaks
- Current and best streak tracking across finished matches
- Fire icon (🔥) badge next to players with streaks of 3+
- Streak utility (`src/lib/streaks.ts`) shared between achievements and profile

### User Profile Page
- Route: `/profile/:userId`
- Displays avatar, display name, total points, accuracy %, current/best streak
- Pick preference distribution (HOME/DRAW/AWAY bar chart)
- Stage-by-stage breakdown table
- Recent prediction history with score/outcome display
- Own profile accessible from topbar; others via leaderboard name click
- Privacy-respecting: other users' predictions only visible within shared groups

### Leaderboard History Graph
- SVG line chart showing cumulative points over time per player
- One polyline per user with distinct colors from a 8-color palette
- Current user's line drawn thicker for emphasis
- Toggle between table and chart views in TablaView
- Data fetched via `get_leaderboard_history` RPC with window functions

### Push Notifications
- Web Push API with VAPID keys for browser notifications
- `push_subscriptions` table to store per-user endpoints
- `send-push` Edge Function (cron-triggered) notifies users with unpredicted matches within 1 hour
- Bell icon in topbar to subscribe/unsubscribe
- Service worker handles `push` and `notificationclick` events

### Match-Day Live Feed
- Fourth tab "En vivo" in the dashboard
- Real-time timeline of match events (goals, kickoffs, halftime, fulltime, red cards)
- Live matches section with real-time scores at the top
- Upcoming today and finished today sections
- Next match countdown in empty state
- `match_events` table with Supabase Realtime subscription
- Events auto-generated by `sync-fixtures` Edge Function on status/score changes

### Match Reactions
- 6 emoji reactions per match (⚽🔥😭😂😱👏) visible after kickoff
- Reaction bar below locked match cards
- Optimistic UI toggle with revert on error
- Aggregated counts per match/emoji with user-reacted state
- `match_reactions` table with per-group RLS

### Group Standings Export
- "Compartir" button renders leaderboard to a styled canvas image
- Dark background with lime accents, medals, group name, date, ranked players
- Uses `navigator.share` on mobile, falls back to PNG download
- Retina-ready (2x DPR canvas)

### Sound Effects
- Three sound cues: whistle (prediction save), crowd (correct pick reveal), ding (achievement earned)
- `useSound` hook with lazy audio loading
- Mute toggle in topbar, preference persisted in localStorage

### Prediction Deadline Extension
- Per-group configurable lock time: at kickoff / 15 min / 30 min / 1 hour before
- Group owner sets via dropdown in group settings
- Frontend-enforced via `isBeforeLockTime()` utility; DB RLS still locks at actual kickoff
- `lock_minutes_before` column on `groups` table

### Ghost/Bot Player
- Random bot player ("Random Bot 🎲") that can be added to any group by the owner
- `ghost-predict` Edge Function generates random predictions daily
- Picks random outcomes (35%/30%/35% HOME/DRAW/AWAY) with Poisson-distributed scores

### Seasonal Archive
- Group owners can archive season standings and stats
- `group_archives` table stores final standings JSON + aggregate stats
- Archive page (`/archive/:groupId/:season`) with podium, full standings, and stat cards
- Read-only historical view of completed seasons

### Multi-Language Support (i18n)
- Full EN/ES translation with ~200 keys per language
- Lightweight custom i18n system (no external library)
- `LocaleContext` provider with `useLocale()` hook
- Language toggle (ES/EN) in topbar
- Locale persisted in localStorage
- All components, pages, achievements, and export canvas use `t()` calls
- Date formatting respects locale

### Database Migrations (v1.2.0)
- `005_exact_score.sql` — `score_home`/`score_away` on predictions, updated standings view with 3/1/0 scoring
- `006_user_profile.sql` — `get_user_predictions_in_group` RPC (security definer)
- `007_leaderboard_history.sql` — `get_leaderboard_history` RPC with cumulative window functions
- `008_push_and_live.sql` — `push_subscriptions` + `match_events` tables, RLS, Realtime
- `009_reactions.sql` — `match_reactions` table + `get_group_reactions` RPC
- `010_deadline_and_sounds.sql` — `lock_minutes_before` on groups
- `011_ghost_and_archive.sql` — ghost profile, `add_ghost_player` RPC, `group_archives` table, `archive_group` RPC

### Edge Functions
- `send-push` — Cron-triggered Web Push notifications for upcoming unpredicted matches
- `ghost-predict` — Daily random prediction generation for bot players

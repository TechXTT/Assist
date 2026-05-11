# assist

A friendly, single-user personal-life dashboard (schedule, tasks, money, health, daily briefing, weekly review). Built per `personal-assistant-master-brief.md`.

**Status:** v1.0 feature-complete. Phases 1 → 6D have shipped. Phase 6E (production deploy on Neon + Vercel) is documented in [DEPLOY.md](./DEPLOY.md) and runs whenever you're ready.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma · NextAuth (Google) · SQLite locally → Postgres on Neon at deploy time.

## Local setup

```powershell
npm install
cp .env.example .env   # then fill it in
npx prisma migrate dev --name init
npm run dev
```

`NEXTAUTH_SECRET` (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

Google OAuth client: create at <https://console.cloud.google.com/apis/credentials>. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`. Scopes: `openid email profile`, Calendar (readonly), Gmail (readonly).

Sign-in is gated to the email in `ALLOWED_EMAIL`. Other accounts are rejected.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` — Prisma migrate dev
- `npm run db:studio` — Prisma Studio

## Scripts (deploy)

- `npm run build:vercel` — `prisma generate && prisma migrate deploy && next build`. Set as the Vercel build command. See [DEPLOY.md](./DEPLOY.md).
- `npx tsx scripts/smoke-ai.ts` — one-shot smoke test for the Anthropic integration. Requires `ANTHROPIC_API_KEY` in `.env`. Prints prose + token counts.

## Modules

- `/dashboard` — today's plan, deadlines, money this month, health this week, wind-down banner, reminder banners.
- `/tasks` — kanban + deadline pressure engine + tiny-first-step (AI-or-template).
- `/money` — spending, budgets, bills & subs, income, goals, cash flow forecast, net worth.
- `/health` — exercise, sleep, nutrition, mood. Calm log, never moralizing.
- `/briefing` — daily prose summary (AI-or-template), 30-day history.
- `/review` — weekly recap + top-3 priorities picker (AI-or-template), 12-week history.
- `/settings` — Google calendar connections, AI usage + monthly cap, preferences.

## AI integration

When `ANTHROPIC_API_KEY` is set, Haiku 4.5 writes the daily briefing, weekly review, and tiny-first-step suggestions. When the key is missing or the user's monthly cap (default €5) is hit, every feature falls back to a deterministic template that fully works. The cap counter on `/settings` is a rough token-based estimate, not Anthropic's billing API.

## Tone

The app's voice is the friend-who-pays-attention: matter-of-fact, observational, never prescriptive. No streaks, badges, productivity-coach cheerleading, wellness-bro moralizing, or therapist suggestions on low mood. Health data in particular is surfaced as data, not judgment.

## Future / deferred work

Tracked but not built for v1:

- **4G — Gmail receipt scan** (specced in `phase-4-brief.md` §4G; will revisit with real receipt samples).
- Email delivery for daily briefing / weekly review.
- Live investment prices via a market-data API.
- Scenario modeling in cash flow ("what if I cancel Spotify?").
- Structured weekly `ExercisePlan` consumption.
- AI-suggested expense categorization on transaction creation.
- Multi-currency with FX conversion.
- Bank / Plaid / Open Banking integration.
- Web push or PWA-based notifications.

Each of these is real future work; none block v1.

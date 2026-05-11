# assist

A friendly, single-user personal-life dashboard (schedule, tasks, money, health, daily briefing, weekly review). Built per `personal-assistant-master-brief.md`.

**Status:** v4 (Banking) shipped on top of v3 (Smart Money), v2 (Inbox & Outbox), and v1.0. v4 adds Open Banking (PSD2 via Enable Banking) — connect Revolut and ~2500 other EU/UK/Nordic banks and have transactions sync nightly into /money. Production deploy is documented in [DEPLOY.md](./DEPLOY.md).

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

Google OAuth client: create at <https://console.cloud.google.com/apis/credentials>. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`. Scopes: `openid email profile`, Calendar (readonly), Gmail (readonly), Gmail (send). The Gmail send scope lets the app deliver the daily briefing / weekly review from your own address.

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
- `/money` — spending (incl. Gmail receipt scanning, v2), budgets, bills & subs, income, goals, cash flow forecast, net worth.
- `/health` — exercise, sleep, nutrition, mood. Calm log, never moralizing.
- `/briefing` — daily prose summary (AI-or-template), 30-day history. Optional email delivery (v2).
- `/review` — weekly recap + top-3 priorities picker (AI-or-template), 12-week history. Optional email delivery (v2).
- `/settings` — Google connections, AI usage + monthly cap, email & notifications (v2), preferences.

## AI integration

When `ANTHROPIC_API_KEY` is set, Haiku 4.5 writes the daily briefing, weekly review, and tiny-first-step suggestions. When the key is missing or the user's monthly cap (default €5) is hit, every feature falls back to a deterministic template that fully works. The cap counter on `/settings` is a rough token-based estimate, not Anthropic's billing API.

## Tone

The app's voice is the friend-who-pays-attention: matter-of-fact, observational, never prescriptive. No streaks, badges, productivity-coach cheerleading, wellness-bro moralizing, or therapist suggestions on low mood. Health data in particular is surfaced as data, not judgment.

## v2 — Inbox & Outbox

v2 turns Assist from read-only into a system that exchanges email with you:

- **Gmail receipt scan** (`/money` → Spending tab → "Receipts from Gmail"). Scans the last 7 days for likely-receipt messages from a maintained sender allow-list, AI-extracts amount / merchant / category, and stages them as drafts you approve or reject. Approved drafts insert as transactions tagged with the source Gmail message id (so re-scans dedupe). Respects the AI monthly cap.
- **Email delivery** (`/settings` → Email & notifications). Toggles for daily briefing and weekly review. You pick the delivery hour (in your timezone) and the weekday for the review. Vercel Cron fires hourly and the route handler sends to whichever users are due.
- **Send mechanism**: Gmail API using your own account (`gmail.send` scope). No transactional email provider, no domain setup.

## v3 — Smart Money

v3 makes the money module less manual:

- **AI-suggested categorization** (`/money` → Spending → "Log a transaction"). After you've typed an amount and description with 3+ characters and haven't picked a category, the form quietly asks Haiku 4.5 to suggest one from your existing budget categories. Shown as a small "Try X" chip you click to accept (or dismiss). Routes through `generateText`, so it respects the AI monthly cap.
- **Cash-flow scenarios** (`/money` → Cash Flow → "Scenarios"). A toggle list of every recurring bill and subscription. Flip one off to remove it from the forecast and see the chart re-shape; a "−€X/mo" chip shows the monthly delta. State lives in URL search params so you can share or reload a scenario. Nothing is actually deleted from the ledger.
- **Live investment prices** (`/money` → Net Worth → "Refresh prices"). A Vercel cron fires daily at 05:00 UTC, fetches quotes for every tracked `Holding` from Twelve Data, and updates `lastKnownPriceCents` + `lastPriceUpdate`. You can also force a refresh from the UI. Set `TWELVE_DATA_API_KEY` to enable; leaving it blank keeps holdings manual.

## v4 — Banking

v4 turns Assist into a live ledger by integrating with PSD2 Open Banking:

- **Enable Banking** (free for personal use). Supports Revolut + ~2500 EU/UK/Nordic banks.
- **Auth**: JWT signed with an RSA private key issued by Enable Banking when you register an application. Each API call signs a fresh JWT with `crypto.createSign('RSA-SHA256')` — no SDK required, no third-party deps.
- **Consent flow** (`/settings` → Banking → "Connect a bank"). Pick country, pick ASPSP, redirect to your bank's auth page, return with a one-time `code`. We exchange the code for a session id and persist a `BankConnection` row.
- **Sync**: a `/api/cron/banking` job runs daily at 03:00 UTC and pulls booked transactions for every active connection. Dedupes via the Enable Banking `transaction_id` (falling back to `entry_reference`), inserts as `Transaction` rows with `source = "bank:<aspsp-name-lowercased>"`. You can also sync manually from `/settings`.
- **Expiry**: PSD2 caps consents at 90 days. The settings card surfaces an "expires in Nd" pill when ≤14 days remain; reconnecting refreshes the window.
- **Disconnect**: tells Enable Banking to revoke the session and removes the connection row. Past transactions stay in the ledger (`bankConnectionId` is set to null).

## Future / deferred work

Tracked but not built yet:

- Multi-currency with FX conversion.
- Structured weekly `ExercisePlan` consumption.
- Web push or PWA-based notifications.
- Gmail Pub/Sub real-time inbox watch (manual scan covers v2).
- Asset allocation views + rebalancing hints on Net Worth.
- Auto-categorize bank-imported transactions on insert (currently inserted with `category = null` — the AI suggestion chip from v3 still works when you edit them).

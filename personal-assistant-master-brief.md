# Personal Assistant — Master Brief

> Paste this entire document into Claude Code as your project brief. Ask Claude Code to read it end-to-end before writing any code, then plan in phases and confirm the plan with the user before scaffolding.

---

## 1. Project context

You are building a **personal-life assistant web app** for a single user (the developer). Treat the developer as the only user — no multi-tenancy, no signup flow for others. The app is a dashboard plus a small set of modules covering schedule, tasks/deadlines, money, and health, with a daily briefing and a weekly review.

### About the user (read this carefully — it shapes every UX decision)

- **Life stage**: university undergraduate.
- **Daily rhythm**: night owl. Wakes after 10am. Don't schedule any reminder, briefing, or animation that assumes early-morning use.
- **Workload**: light, mostly self-directed — few externally-imposed deadlines. The app's job is to manufacture useful structure, not just track existing structure.
- **Self-described procrastinator** who responds to **hard deadlines and visible countdowns**, not gamification, streaks, or pomodoro timers. Build accordingly.
- **Budget**: modest but stable. Every paid dependency is a problem. Default to free tiers and self-hostable choices.
- **Tone preference**: friendly and casual — like a helpful friend, not a corporate productivity app. All copy (microcopy, AI-generated text, error messages) must match.
- **Autonomy preference**: "suggest, I decide". The assistant proposes, drafts, reminds — it does not send emails, post to calendars, or execute transactions on its own. Anything that mutates external data requires an explicit confirm step.
- **Existing tools**: Google Calendar is the source of truth for scheduling. Gmail is read-only context. He uses Microsoft Outlook/Teams and various phone apps casually but does not want this app to integrate with them in v1.

### Vision in one paragraph

A friendly, calm web app the user can open on either his laptop or phone that shows him — at a glance — what's on his plate today, what deadlines are looming, how his money is doing this month, and how his sleep/exercise/mood have been trending. It nudges him with hard-deadline reminders to fight procrastination, suggests "first tiny steps" when something has been sitting too long, and gives him a late-morning briefing and a Sunday-evening weekly review. It never acts on his behalf without confirmation.

---

## 2. Tech stack (recommended — flag deviations to the user)

- **Framework**: Next.js 14+ (App Router) with TypeScript. Single repo, single deployment.
- **Styling**: Tailwind CSS + shadcn/ui components.
- **Database**:
  - Local dev: SQLite via Prisma.
  - Production: Postgres on Neon or Supabase free tier (still through Prisma).
- **Auth**: NextAuth.js with Google provider. Single-user — gate the app to the developer's Google account email via an env var allowlist.
- **Google integration**: NextAuth Google OAuth scopes for Calendar (read) and Gmail (read). Store refresh tokens in DB; never expose them client-side.
- **Hosting**: Vercel free tier. Database on Neon free tier. No paid services in v1.
- **AI**: optional — for "first tiny step" generation and weekly-review summarization, use Anthropic API via server-side route. Make this **togglable via env var** so the app fully works without an API key (fall back to template strings).
- **Charts**: Recharts (already plays nicely with React).
- **State**: server components + React Server Actions where possible; TanStack Query only if needed for client-side polling.
- **Date/time**: `date-fns` + `date-fns-tz`. All times stored as UTC; rendered in the user's timezone (read from browser, fallback to env-configurable default).

If you (Claude Code) want to deviate from any of these, ask first.

---

## 3. Architecture overview

```
app/
  (public)/login/                  # NextAuth sign-in
  (app)/                           # Authenticated routes
    dashboard/                     # The "live dashboard" — home page
    tasks/                         # Tasks & deadlines
    money/                         # Spending, budgets, bills, goals
    health/                        # Exercise, sleep, nutrition, mood
    briefing/                      # Today's briefing (also rendered as a card on dashboard)
    review/                        # Weekly review
    settings/                      # Connections, preferences, timezone
  api/
    auth/[...nextauth]/
    google/calendar/sync           # Pull events
    google/gmail/scan              # Scan for bills/receipts/deadlines
    cron/daily-briefing            # Vercel Cron, fires ~11am local
    cron/weekly-review             # Vercel Cron, fires Sunday 6pm local
lib/
  db.ts                            # Prisma client
  google/                          # Google API helpers
  ai/                              # Anthropic client + prompt templates (gated by env)
  reminders/                       # Deadline-pressure logic
prisma/
  schema.prisma
```

**Data flow rule**: any external data (Google) is pulled server-side, normalized, and persisted. The UI never calls Google directly.

---

## 4. Data model (Prisma schema sketch)

Implement at minimum these models. Add fields as you build, but don't remove any from this list without asking.

- `User` — id, email, name, timezone, briefingTime (default 11:00), createdAt.
- `Account` — NextAuth account model; stores Google refresh token.
- `Task` — id, userId, title, description, dueAt (nullable), priority (low/med/high), status (todo/doing/done), createdAt, completedAt, source (manual/gmail/calendar), externalId (nullable), tinyFirstStep (nullable text — generated suggestion).
- `CalendarEvent` — id, userId, googleEventId (unique), title, startsAt, endsAt, location, description, lastSyncedAt.
- `Bill` — id, userId, name, amountCents, currency, dueDay (1–31) or dueDate (one-off), recurring (bool), category, lastPaidAt, source (manual/gmail), externalId (nullable).
- `Subscription` — id, userId, name, amountCents, currency, billingCycle (monthly/annual), nextChargeAt, category, suspectedUnused (bool), source.
- `Transaction` — id, userId, amountCents (negative = expense), currency, description, category, occurredAt, source (manual/gmail), externalId (nullable).
- `BudgetCategory` — id, userId, name, monthlyLimitCents, color.
- `SavingsGoal` — id, userId, name, targetCents, savedCents, targetDate (nullable), notes.
- `HabitLog` — id, userId, date (date only), sleepHours (nullable), exerciseMinutes (nullable), mealsLogged (int), waterGlasses (int), mood (1–5, nullable), notes.
- `ExercisePlan` — id, userId, name, weeklyTargetMinutes, days (json array of weekdays).
- `Reminder` — id, userId, taskId or billId, fireAt, level (gentle/firm/urgent), sentAt (nullable). Generated/updated by the deadline-pressure engine.

Use `cents` integers for money, never floats.

---

## 5. The six modules — feature specs

### 5.1 Live Dashboard (home page, `/dashboard`)
Single page, mobile-responsive. Sections in this order top-to-bottom:

1. **Hello card** — friendly greeting with first name and the single most important thing today (next event OR top-priority task with closest deadline). One sentence, casual tone.
2. **Today** — today's calendar events (from Google) and tasks due today, in chronological order. Tap to expand.
3. **Deadlines this week** — sorted by countdown. Each shows: title, deadline, days/hours left, color-coded by urgency (green > 5 days, amber 2–5, red < 2). Click → task detail.
4. **Money this month** — spending vs. budget bar (overall), top 3 categories, upcoming bills in next 7 days.
5. **Health this week** — sleep avg, exercise minutes vs. target, mood mini-trendline, "log today" button.
6. **Quick actions** — Add task, Log expense, Log workout, Open briefing, Open weekly review.

**Acceptance**: dashboard loads in <1s with cached data; "Reload" button re-syncs Google. Empty states are friendly ("No deadlines this week — nice 🍃" — minimal emoji, opt-in).

### 5.2 Daily Briefing (`/briefing`, also runs as cron)
Triggered by Vercel Cron at the user's `briefingTime` (default 11:00 local). Generates a briefing record stored in DB and (later, post-v1) sent via email. For v1 it's just a viewable page.

Contents:
- Today's schedule (events + tasks).
- Top 3 priorities (auto-picked by deadline + priority).
- Bills due in next 7 days.
- Yesterday's spending summary, with a one-line callout if any category went over budget.
- One health nudge — pick the most "behind" metric (e.g., "you've slept under 6h three nights in a row").
- One "first tiny step" suggestion for the most-stalled task.

Tone: short paragraphs, friendly, no bullet points. If AI is enabled, generate the prose; if not, use a deterministic template.

### 5.3 Deadline Pressure Engine (`/tasks` + background logic)
A tasks page (kanban-lite: Todo / Doing / Done) plus a background reminder generator.

Rules:
- Every task with a `dueAt` gets a visible countdown (days/hours).
- The system creates `Reminder` rows automatically: gentle at 7 days, firm at 2 days, urgent at 12 hours, final at 1 hour. Reminders surface as banners on the dashboard and are listed on the task page.
- For any task in `Todo` for >3 days with no progress and a `dueAt` < 14 days away, the engine generates a `tinyFirstStep` (via AI if enabled, else a templated nudge: "Open the doc and write one sentence.").
- Tasks completed at least 6 hours before their deadline get a small "early ✓" annotation in the UI (no streaks, no points — just gentle positive feedback).

Manual task creation form: title, due date/time, priority, optional notes. No required fields beyond title.

### 5.4 Money Module (`/money`)
Tabs: Spending, Budgets, Bills & Subscriptions, Goals.

- **Spending**: list of transactions, filter by category and date range, monthly chart by category (Recharts donut + bar). Manual add form. Optional Gmail scan to suggest transactions from receipts (always shown as "Suggested — confirm to add").
- **Budgets**: per-category monthly limits. Progress bars. Banner if any category is >80% used with >7 days left in month.
- **Bills & Subscriptions**: two lists. Each row shows next due date and a "remind me 3 days before" toggle (default on). For subscriptions, surface a `suspectedUnused` flag based on a simple rule (no related transactions logged in 60 days, or user marked it). Suggest cancel — never act.
- **Goals**: create a savings goal with target amount + date. Manual "I saved $X" button updates progress. Show progress bar and projected completion date.

Money copy: cost-conscious framing. E.g., "you've spent $42 on coffee this month — that's about a textbook" (only if textbook reference is configurable; otherwise just "that's $X over your $Y limit").

### 5.5 Health Module (`/health`)
Four sub-sections, all very lightweight (he doesn't use a fitness app yet — don't replicate one):

- **Exercise**: weekly minute target (default 90), simple log form (activity, minutes, date). Weekly progress bar. List of recent sessions.
- **Sleep**: log bedtime + wake time (or hours). Show 7-day average and a chart. Wind-down reminder configurable (default 30min before user's target bedtime; off by default since he's a night owl — let him opt in).
- **Nutrition**: just hydration glasses + meals logged (count, not detail). Optional one-line note per day.
- **Mental health & habits**: daily 1–5 mood check-in with optional note. 14-day mood trendline. Suggest a "study break" if user is on the app continuously for >50min (configurable).

No calorie counting, no macros, no scale weight in v1.

### 5.6 Weekly Review (`/review`, also runs as cron)
Sunday 6pm local. Generates a review page covering:
- What got done this week (completed tasks + key calendar events).
- What slipped (overdue tasks, missed habits).
- Money summary: total spent vs. budget, top categories, savings progress delta.
- Health summary: sleep avg, exercise total, mood avg.
- A prompt: "Pick top 3 priorities for next week" — clicking saves them as starred tasks for the coming week.

If AI is enabled, generate a short narrative (3 paragraphs, casual tone) summarizing the week.

---

## 6. Integrations

### Google OAuth
- Scopes: `openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly`.
- Use NextAuth's Google provider. Persist `refresh_token` and `access_token` in the `Account` table.
- Build small wrappers in `lib/google/` for: `listEvents(userId, range)`, `searchGmail(userId, query)`.
- Sync Calendar on a 15-minute schedule via Vercel Cron (or on dashboard load if cache is older than 15min).
- Gmail scan is opt-in only and runs on demand from `/money` — never automatic.

### Anthropic API (optional)
- Env var: `ANTHROPIC_API_KEY`. If unset, all AI features fall back to templates.
- Use the SDK (`@anthropic-ai/sdk`). Use a small fast model for "first tiny step" generation, a slightly larger one for weekly review narrative.
- All AI calls are server-side; never expose the key.
- Hard-cap monthly spend with a counter in DB (rough — sum prompt+completion tokens × posted rates) and disable AI features for the rest of the month if exceeded. Default cap: $5.

### Email-out (post-v1, do NOT build in v1)
Briefings are page-rendered only in v1. Email delivery is a Phase 6 stretch.

---

## 7. Build phases

Implement in order. After each phase, ask the user to verify before moving on.

**Phase 1 — Scaffolding & auth**
- Init Next.js + Tailwind + shadcn + Prisma + NextAuth (Google).
- Single-user email allowlist via env.
- Empty pages for all six modules with placeholder copy and a working nav.
- DB migrated with the full schema from §4.

**Phase 2 — Tasks & Deadline Pressure**
- Tasks CRUD, kanban-lite UI, countdowns, manual reminders.
- Reminder generator (cron job).
- "First tiny step" template (no AI yet).
- Dashboard "Deadlines this week" + "Today" sections wired up.

**Phase 3 — Google Calendar integration**
- OAuth working, sync endpoint, persisted events.
- Dashboard shows real events.
- Settings page lists connected accounts.

**Phase 4 — Money module**
- Manual transaction CRUD, budgets, bills/subscriptions, goals.
- Dashboard "Money this month" section.
- Budget alerts.
- Gmail scan opt-in: surface suggested transactions for confirmation only.

**Phase 5 — Health module**
- Exercise, sleep, nutrition, mood logging.
- Dashboard "Health this week" section.

**Phase 6 — Briefings, Weekly Review, AI**
- Daily briefing page + cron.
- Weekly review page + cron.
- Anthropic integration for first-tiny-step + review narrative (gated by env var).
- Polish pass: empty states, loading skeletons, dark mode, mobile review.

---

## 8. Non-obvious requirements (do not skip)

1. **Late-morning briefing**: default cron at 11:00 user-local. Never default to before 10am.
2. **Hard deadlines visible everywhere**: countdowns on dashboard, tasks page, briefing, and weekly review. Color-coded.
3. **Suggest, don't act**: the assistant never sends emails, creates calendar events, or executes payments. Anything that writes to an external system goes through a confirm UI.
4. **Friendly casual tone**: review every string. "Heads up — your phone bill's due Friday" not "REMINDER: Phone bill payment due 2026-XX-XX".
5. **No streaks, no points, no pomodoro by default**: gamification doesn't motivate this user. Hard deadlines + tiny-first-step suggestions do.
6. **Free-tier first**: no paid services without explicit user approval. AI is gated and capped.
7. **Privacy**: Google tokens are server-side only. No third-party analytics. No telemetry to external services.
8. **Mobile responsive from day one**: he uses both desktop and phone. Test every page at 375px wide.
9. **Empty states are friendly**: "No bills due this week — nothing to dread" type copy. Never blank.
10. **All times in the user's timezone**: store UTC, render local. Default timezone configurable in `/settings`.

---

## 9. What "v1 done" looks like

- The user can log in with his Google account.
- Dashboard shows real Google Calendar events for today/this week.
- He can add a task with a deadline and see countdown reminders escalate.
- He can log a transaction and see it count against a budget.
- He can log sleep and a mood; the dashboard reflects it.
- The daily briefing page renders with today's data.
- The weekly review page renders on Sundays.
- Everything works without an Anthropic API key (templated fallbacks).
- Deployed to Vercel; Postgres on Neon; cron jobs running.

---

## 10. How to use this brief

1. Read the whole document before writing any code.
2. Propose a Phase 1 plan: file tree, dependencies, schema, env vars. Confirm with the user.
3. After each phase, demo what works and ask for sign-off before starting the next phase.
4. If something is ambiguous or you want to deviate from the stack/approach, ask — don't guess.
5. Match the friendly-casual tone in any UI copy you write.
6. Default to free-tier choices; flag any paid dependency before adding it.

That's the whole brief. Build with care — this is for one specific person, and the details matter.

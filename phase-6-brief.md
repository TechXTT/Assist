# Phase 6 Brief — Briefings, Review, AI, Polish, Deployment (final phase)

> Paste this into Claude Code as a follow-up. Read end-to-end, propose sub-phase ordering + migration + deployment plan, confirm with the user, implement sub-phases sequentially with demos between each. After Phase 6 lands, v1 is shipped — the assistant is real, deployed, and ready for daily use.

---

## 1. What this phase delivers

By the end of Phase 6, the user can:

1. Open `/briefing` and see a short prose summary of today (schedule, top priorities, upcoming bills, neutral health/money snapshot, one tiny-first-step suggestion for the most-stalled task). Generated lazily on first visit per day; cached in DB.
2. Open `/review` on Sunday (or any day during a week) and see a 3-paragraph recap of the past week: what got done, what slipped, money summary, health summary, a "pick top 3 for next week" prompt.
3. Get **AI-generated prose** when `ANTHROPIC_API_KEY` is set (Haiku 4.5 by default), with deterministic template fallback when the key is missing or the monthly cap is hit. Three AI features: tiny-first-step generation (replaces Phase 2 templates), daily-briefing prose, weekly-review narrative.
4. Experience a **polish pass**: loading skeletons on slow operations, friendly empty states everywhere, dark mode toggle, full keyboard accessibility, 375px mobile review of every page.
5. Use the app **deployed in production** — Postgres on Neon, hosting on Vercel, Google OAuth redirect updated to the production domain, env vars migrated.

After this phase, v1 is done.

---

## 2. Sub-phase ordering

Ship in this order. Demo + sign-off between each.

- **6A** — Daily Briefing (template-driven first, no AI yet).
- **6B** — Weekly Review (template-driven first, no AI yet).
- **6C** — AI Integration (Anthropic Haiku, layered onto 6A/6B + Phase 2 tiny-first-step).
- **6D** — Polish pass (loading states, empty-state audit, dark mode, accessibility, mobile review).
- **6E** — Production deployment (SQLite → Postgres on Neon, deploy to Vercel, OAuth redirect update).

If the user wants to defer 6E (stay local-only) that's fine — but 6A–6D should always ship in full.

---

## 3. Pre-flight

- The unified reminder pipeline (`src/lib/reminders/` from Phase 4C) is the home for any new reminder kinds in this phase. Don't fork it.
- Read-on-demand staleness pattern (Phase 3 calendar, Phase 4K cash flow) applies to briefings and reviews too. **No cron jobs.** Generation triggers when the user first visits the page on a new day/week.
- All copy continues to follow the tone discipline from earlier phases. The Health module's §2 ("never moralize, never auto-suggest interventions, never streak/badge") binds here too — the daily briefing's "health nudge" surfaces *data*, not *judgment*.
- AI features are **gated by `ANTHROPIC_API_KEY` env var**. If unset, every AI feature must fall back to a deterministic template that fully works.

---

## 4. Schema additions (pre-authorized)

```prisma
model DailyBriefing {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  forDate      DateTime                            // date-only; one briefing per user per local date
  body         String                              // generated prose (template or AI)
  generatedBy  String                              // "template" | "ai"
  modelUsed    String?                             // e.g., "claude-haiku-4-5-20251001"
  generatedAt  DateTime @default(now())
  @@unique([userId, forDate])
}

model WeeklyReview {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  forWeekStart  DateTime                            // Monday of the reviewed week in user tz, date-only
  body          String                              // generated prose
  generatedBy   String
  modelUsed     String?
  generatedAt   DateTime @default(now())
  topPriorities String?                             // JSON array of task ids the user picked for next week
  @@unique([userId, forWeekStart])
}

model AiCall {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  feature              String                       // "tiny_first_step" | "daily_briefing" | "weekly_review"
  model                String                       // "claude-haiku-4-5-20251001"
  promptTokens         Int
  completionTokens     Int
  estimatedCostCents   Int                          // rough — computed from model + token counts at call time
  occurredAt           DateTime @default(now())
  @@index([userId, occurredAt])
}
```

Plus on `User`:

```prisma
model User {
  // ... existing ...
  aiMonthlyCapCents Int @default(500)               // €5/month default cap
}
```

No changes to existing models. Migration: `<ts>_briefing_review_ai`.

---

## 5. Sub-phase 6A — Daily Briefing

### Contents (in this order)
1. **One-sentence opener** — friendly greeting plus the single most important thing today (next event OR top-priority task with closest deadline).
2. **Today's plan** — events + tasks merged chronologically, short prose form ("You've got Linear Algebra at 10, then the gym at 3, and the lab report draft is due by midnight.").
3. **Top 3 priorities** — picked by deadline urgency + priority; short list as inline prose.
4. **Money corner** — bills due in next 7 days (count + total); over-budget categories if any (calm callout, no scolding); current-month net if income tracking is in use. Surface data, no judgment.
5. **Health snapshot** — sleep average over last 7 nights; exercise minutes this week vs target; latest mood entry if logged. **Data only**, never moralizing. If multi-day low mood, do not surface anything beyond the data point.
6. **One tiny-first-step** — for the most-stalled todo task (most days since last touch, deadline within 14 days). Shows the suggestion inline with a "Open task" link.

### Generation logic (`src/lib/briefing/`)

- `buildBriefingPayload(userId, date, tz)` — pure data fetch returning everything the briefing needs.
- `renderTemplate(payload)` — deterministic string assembly from the payload. Three short paragraphs, no bullets, no emoji, friendly-casual.
- `renderViaAi(payload)` — sends payload as structured JSON to the model with a strict system prompt enforcing tone (see §7). Returns prose.
- `getOrCreateBriefing(userId, date, tz)` — reads existing `DailyBriefing` for the date; if missing, builds payload, tries AI if available, falls back to template, persists, returns.

### Page (`/briefing`)
- Server component fetches via `getOrCreateBriefing(userId, today, tz)`.
- Renders body as a single column, max-width readable.
- Date selector to view past briefings (read-only — no regen for past dates).
- Below the prose: a tiny "Regenerate" button (only for today; cooldown of 5 minutes to prevent abuse; counts against AI budget).
- Empty-data fallback: if there's literally nothing to brief (no calendar, no tasks, no money entries), render a calm "Quiet morning. Nothing on the radar yet — try adding a task or logging something on /tasks or /money."

**Checkpoint 6A:** with template renderer only, briefings generate correctly for today, prior days are viewable from history, copy passes the read-aloud test. Demo + sign-off.

---

## 6. Sub-phase 6B — Weekly Review

### Contents (in this order)
1. **Week recap** (one paragraph): what got done — completed tasks count + a few highlights; key calendar events.
2. **What slipped** (one paragraph): overdue tasks (count + a few names), days without a mood entry, exercise vs target, sleep average. Neutral framing; "slipped" is the user's observation surface, not a verdict.
3. **Money summary** (one paragraph): total spent this week vs week-share-of-budget; biggest category; savings progress delta; net income vs outflow if 4H is shipped; subscription creep callout if applicable (carry from 4K logic).
4. **Top priorities prompt** — interactive: shows current todo tasks sorted by urgency, lets user pick (or type) 3 priorities for next week. Picked tasks get `priority = "high"` (reuse existing field, no schema change). Persisted in `WeeklyReview.topPriorities` as JSON of task ids.

### Generation
- Same shape as 6A: `buildReviewPayload(userId, weekStart, tz)`, `renderTemplate(payload)`, `renderViaAi(payload)`, `getOrCreateReview(userId, weekStart, tz)`.
- Review is generated lazily when user visits `/review` AND `now >= sundayEvening` of the week being reviewed. Visiting `/review` earlier in the week shows last-completed week's review.
- Week starts Monday in user's tz.

### Page (`/review`)
- Shows current-week (or most-recent-completed) review.
- Week selector to browse history.
- Top-priorities-picker is interactive only for the most recent week — past reviews show the picks read-only.
- A regenerate button on current week, same cooldown rule as 6A.

**Checkpoint 6B:** with template renderer only, a review generates correctly after a populated week, the priorities picker writes back to tasks, history is browsable. Demo + sign-off.

---

## 7. Sub-phase 6C — AI Integration

### Setup
- `npm install @anthropic-ai/sdk`.
- New helper `src/lib/ai/client.ts`:
  - Reads `ANTHROPIC_API_KEY` from env. If unset, every public function returns `null` so callers cascade to templates.
  - Exposes `generateText({ userId, feature, systemPrompt, userPayload, model = "claude-haiku-4-5-20251001", maxTokens = 600 })`.
  - Before calling: check current-month spend via `AiCall` sum for the user. If ≥ `user.aiMonthlyCapCents`, return null (template fallback). After call: persist an `AiCall` row with token counts and rough cost estimate.
  - Rough cost calc: use a small per-model rate table in `src/lib/ai/pricing.ts` — input cents-per-million-tokens, output cents-per-million-tokens, easy to update.
- `src/lib/ai/prompts.ts` — system prompts for each feature, written to enforce:
  - Friendly-casual tone (like a helpful friend, not a productivity coach).
  - No emoji unless the user themselves uses them in input.
  - No moralizing about health, money, or productivity.
  - No "great job!"/"crushed it" cheerleading on health or task completion.
  - No mental-health suggestions on low mood (just surface the data point).
  - Single-user context — refer to them as "you," never third-person.
  - Output format: short paragraphs, no bullets, no headers.

### Three integration points

1. **Tiny-first-step generation** — `src/lib/tasks/tiny-first-step.ts` (from Phase 2): if AI is available, call `generateText({ feature: "tiny_first_step", ... })` with the task title + days untouched + deadline distance. Otherwise use the existing 10-template hash pick. Persist the returned text on `Task.tinyFirstStep`. Don't regenerate if a value already exists.

2. **Daily briefing prose** — `src/lib/briefing/renderViaAi.ts`: takes the payload from 6A's `buildBriefingPayload`, formats as compact JSON, asks the model to produce 3 short paragraphs covering the sections. Stores result in `DailyBriefing.body` with `generatedBy = "ai"`.

3. **Weekly review narrative** — `src/lib/review/renderViaAi.ts`: same pattern as briefing, with the more involved review payload. Use the same Haiku 4.5 model — quality is sufficient for casual prose and cost stays predictable.

### Fallback rule (load-bearing)
Every code path that uses AI must work fine without it. The "fallback to template" path is the default behavior; AI is the enhancement. If `ANTHROPIC_API_KEY` is unset or the cap is hit:
- Tiny-first-step uses the 10-template hash from Phase 2.
- Briefings render the deterministic template from 6A.
- Reviews render the deterministic template from 6B.

No AI feature can "fail" the user. The non-AI path is always functional.

### Cap enforcement UX
- On `/settings`, show a small "AI usage" section: current-month estimated spend (e.g., "€0.42 of €5 used"), monthly cap input (default €5, can edit). When cap is hit, surface a friendly notice ("AI features paused for the month — templates still work. Adjust cap on /settings if you want more."). No alarm.

**Checkpoint 6C:** with `ANTHROPIC_API_KEY` set, tiny-first-step / briefing / review all show AI-generated prose; without the key, they show templates seamlessly. AI usage counter in /settings updates after calls. Demo + sign-off.

---

## 8. Sub-phase 6D — Polish pass

This phase is intentionally broad — comb through the whole app and tighten the edges. Concretely:

### Loading & error states
- Every server-fetched page gets a `loading.tsx` skeleton matching its layout. Use shadcn `Skeleton` component or simple `animate-pulse` divs.
- Slow operations (calendar sync, AI generation, Gmail scan if shipped) show inline progress indicators where they happen, not full-page spinners.
- Errors render as friendly inline messages, never crash boundaries — wrap each main module page in an `error.tsx` with a "Something glitched — reload?" fallback. Log to console for dev debugging.

### Empty-state audit
- Walk every screen and confirm empty states pass the read-aloud test. The Money and Health modules already got this; double-check Tasks, Dashboard sections, Settings, Briefing, Review.

### Dark mode
- shadcn supports dark mode natively via `next-themes`. Add `<ThemeProvider>` to root layout. Add a small theme toggle to the nav (sun/moon icon — fine to use these as functional icons, not decorative emoji).
- Verify every screen renders cleanly in dark mode — special attention to: chart colors (Recharts needs explicit dark-mode color tokens), borders, badges, banner backgrounds.

### Accessibility pass
- Keyboard navigation: every interactive element reachable via Tab; visible focus rings; logical tab order on every page.
- Screen reader labels on icon-only buttons (the avatar dropdown, theme toggle, dismiss buttons, etc.).
- `prefers-reduced-motion` respected: disable the countdown live-tick and any transitions when set.
- Color contrast: stone/amber/red text on backgrounds meets WCAG AA. Run a Lighthouse audit and address any flagged issues.

### Mobile review (375px)
- Open every route on a 375px viewport and confirm: nothing overflows horizontally, all tap targets ≥44px, no hover-only interactions, forms are thumb-reachable. The bottom tab bar from Phase 1 should still feel right.

### Stale-while-revalidate on calendar
- The Phase 3 calendar sync currently awaits before render, which adds a cold-load delay. Switch to a SWR-style pattern: render cached events immediately, kick off a background sync via a server action triggered from a client component on mount, show a small "refreshing" indicator near the top. Keeps the dashboard snappy.

### Bundle / performance
- Check `next build` output for unusually large client components. Move any leaf component that doesn't need state to a server component if it isn't already.
- Lazy-load Recharts where possible (it's a heavy bundle). Use `next/dynamic` with `ssr: false` for chart components.

**Checkpoint 6D:** dark mode works on every page, Lighthouse accessibility score is ≥95 on the dashboard, no empty state slips through the read-aloud test, calendar feels instant on cold load. Demo + sign-off.

---

## 9. Sub-phase 6E — Production deployment

### Pre-deployment
- Move the project out of OneDrive if it hasn't moved already. (The recurring Prisma engine binary issue is a symptom of this — production deploy is a good moment to do it cleanly.)
- Confirm everything works locally with the move applied.

### Database migration (SQLite → Postgres)
1. Sign up for Neon (free tier). Create a project. Copy the connection string.
2. Update `prisma/schema.prisma`:
   - `datasource db { provider = "postgresql" url = env("DATABASE_URL") }`
   - **Fix `ExercisePlan.days`**: change from CSV `String` to `Json` (the original schema's migration TODO).
   - Verify all `Decimal` fields have `@db.Decimal(N, M)` annotations.
3. `prisma migrate dev --name init_postgres` — generates a fresh migration history for Postgres.
4. The dev DB doesn't migrate over — accept that local SQLite data is sandbox-only. Production starts fresh.

### Vercel deployment
1. Push to a private GitHub repo (or use an existing one).
2. Import to Vercel. Set framework preset to Next.js (auto-detected).
3. Add env vars in Vercel dashboard:
   - `DATABASE_URL` — Neon connection string (use the pooled URL).
   - `DIRECT_URL` — Neon direct URL (for migrations).
   - `NEXTAUTH_SECRET` — generate fresh, don't reuse the dev secret.
   - `NEXTAUTH_URL` — the production Vercel URL (e.g., `https://assist-xxx.vercel.app`).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — same Google OAuth client.
   - `ALLOWED_EMAIL` — the user's email.
   - `ANTHROPIC_API_KEY` — if AI features wanted in production.
   - `DEFAULT_CURRENCY` — current value (EUR).
   - `CALENDAR_SYNC_STALENESS_MINUTES` — current value (15).
4. Update Google OAuth client (Google Cloud Console): add `https://assist-xxx.vercel.app/api/auth/callback/google` as an authorized redirect URI.
5. Deploy. First request will run pending migrations via Prisma's deployment hooks (or run `prisma migrate deploy` as a build step — add to `package.json` `"build": "prisma generate && prisma migrate deploy && next build"`).

### Post-deployment smoke test
- Visit the production URL → sign in with Google → land on dashboard.
- Verify all six modules render cleanly with empty state.
- Connect Google Calendar → confirm sync works.
- Add a task with a near deadline → confirm reminder banner appears.
- Log a transaction, a budget, a bill → confirm money card updates.
- Log sleep, exercise → confirm health card updates.
- Open `/briefing` and `/review` → confirm they generate.
- If AI is enabled: confirm AI-generated prose appears; if not, confirm templates work.
- Test on phone at the production URL.

### Custom domain (optional)
- If you have a domain, add it to Vercel project, update `NEXTAUTH_URL` and OAuth redirect URI accordingly.

**Checkpoint 6E:** production URL works end-to-end on desktop and mobile, all data flows through Postgres, AI features (if enabled) draw down the budget correctly. Demo + sign-off.

---

## 10. Tone — final reminders

Every prose surface the AI touches is a place where it can slip into:
- **Productivity-coach voice**: "Let's crush today!" / "You've got this!" — forbidden.
- **Wellness-app voice**: "Remember to be kind to yourself today 🌱" — forbidden.
- **Finance-app voice**: "Great savings this month! 💰" — forbidden.
- **Therapist voice**: "I noticed you've been feeling low — consider reaching out." — forbidden, especially.

The voice we want is the friend-who-pays-attention: matter-of-fact, observational, never prescriptive. "You've got Linear Algebra at 10, the lab report's due by midnight, and the gym is in your calendar at 3 — busy day." That's the register. No coach. No wellness guru. No bro.

The system prompts in `src/lib/ai/prompts.ts` carry this responsibility. Write them defensively — assume the model defaults to over-enthusiasm and steer hard the other way.

---

## 11. Final acceptance criteria — v1 done

This phase + the whole product is "done" when:

- [ ] All Phase 6 migrations run cleanly on Postgres.
- [ ] `/briefing` renders today's briefing on first visit per day; cached after.
- [ ] `/review` renders the most recent completed week's review; current-week reviews appear after Sunday evening.
- [ ] Top-priorities picker on `/review` writes back to tasks correctly.
- [ ] Tiny-first-step generation works in both template and AI modes; transitions seamlessly when key toggles.
- [ ] AI cap enforcement: hitting the monthly cap pauses AI features cleanly, templates take over, `/settings` shows usage; raising the cap re-enables.
- [ ] Dark mode renders cleanly on every route.
- [ ] Lighthouse accessibility score ≥95 on dashboard; keyboard navigation works end-to-end.
- [ ] All loading skeletons match their final layouts (no jarring shifts).
- [ ] Calendar uses SWR pattern; cold dashboard load feels instant.
- [ ] Production deploy on Vercel + Neon is live and the user is signed in.
- [ ] OAuth works on the production domain.
- [ ] All six modules functional in production with real data flowing.
- [ ] `npx tsc --noEmit` and `npx next build` clean.
- [ ] Tone audit: every AI-generated and template-generated string passes the read-aloud test. Especially the briefing/review prose.

When all of the above is checked, v1 is shipped. Note in the project README: "v1.0 shipped — features locked. Future work (4G Gmail receipt scan, email delivery for briefings, live investment prices, scenario modeling, structured exercise plans, AI-suggested expense categorization) tracked as separate phases."

---

## 12. Don't deviate without asking

Stop and ask before:
- Adding cron jobs (read-on-demand stays the pattern).
- Building email delivery for briefings/reviews (out of scope for v1; deferred).
- Building 4G Gmail receipt scan (separate phase if/when the user wants it).
- Switching from Anthropic to another model provider.
- Removing the template fallback paths from any AI feature.
- Using OpenAI/Cohere/etc. — Anthropic only.
- Auto-suggesting actions based on AI-detected patterns (e.g., "I noticed you've been overspending on coffee" — forbidden).
- Adding telemetry, analytics, or any third-party scripts in the polish pass.
- Hardcoding the user's name/email anywhere it isn't sourced from the session.
- Skipping any sub-phase ordering — 6A → 6B → 6C → 6D → 6E in order.
- Mixing 6D polish work into earlier sub-phases — keep it as a focused pass after the features ship.
- Treating the cap counter as exact — it's a rough estimate, that's fine, no need to call Anthropic's billing API.

After 6E: walk through the production app end-to-end with the user, verify all the v1-done checkboxes, commit a `v1.0.0` tag, and note any rough edges in a `FUTURE.md` for the next round. Then close out the project as shipped.

---

## What's deferred past v1 (track but don't build)

- **4G Gmail receipt scan** — opt-in Gmail-based suggested transactions. Bring back once enough real receipts have accumulated to test the parser against.
- **Email delivery** for daily briefing / weekly review.
- **Live investment prices** via a market data API.
- **Scenario modeling** in cash flow ("what if I cancel Spotify?").
- **Structured weekly exercise plans** via the existing `ExercisePlan` model.
- **AI-suggested expense categorization** on transaction creation.
- **Multi-currency** with FX conversion.
- **Bank / Plaid / Open Banking integration**.
- **Push notifications** (web push or PWA-based).

Each of these is a real future feature; none of them are blocking v1. Ship v1 first; iterate from a working product, not a planning doc.

# Phase 5 Brief — Health Module

> Paste this into Claude Code as a follow-up. Read end-to-end, propose a plan with sub-phase ordering + migration, confirm with the user, then implement in sub-phases with demos between each. Phase 5 is intentionally lightweight — the user doesn't currently use any fitness/health app, so this isn't replacing one, it's a calm in-house log that feeds the daily briefing and weekly review later.

---

## 1. What this phase delivers

By the end of Phase 5, the user can:

1. Open `/health` and see four sub-sections (or tabs, depending on layout): **Exercise**, **Sleep**, **Nutrition**, **Mood & habits**.
2. Log an exercise session (activity + minutes + date) and see the week's total versus a weekly target. Recent sessions list.
3. Log sleep (just hours, or bedtime + wake time → derived hours). See a 7-day average and a small chart of recent nights.
4. Log hydration (water glasses) and meals (count, not detail), plus an optional one-line note per day.
5. Log a daily mood check-in (1–5) with optional note. See a 14-day trendline.
6. Optionally opt in to a **wind-down reminder** that surfaces a banner on the dashboard a configurable number of minutes before a target bedtime. **Off by default** — the user is a night owl, no implicit pressure to shift earlier.
7. See a **Health this week** card on the dashboard summarizing sleep avg, exercise minutes vs target, mood mini-trendline, with a "log today" quick action.

Explicitly out of scope: calorie counting, macros, weight tracking, biometric integrations (Apple Health, Fitbit, etc.), workout plan generation, food databases, sleep stage analysis, period tracking, mental health interventions of any kind beyond surfacing the user's own data.

---

## 2. Design philosophy (read carefully — health is sensitive)

The user is a night-owl undergrad procrastinator. The most common failure mode for a self-tracking app in his situation is to slip into one of two voices: **wellness-bro cheerleading** ("Crushed it today! 💪🔥") or **nag-app moralizing** ("You're below the recommended 8 hours of sleep"). Both are exactly wrong here.

This module's voice is **matter-of-fact and supportive, never prescriptive**:

- Show the user his own data. Let him draw conclusions.
- Targets exist only when the user sets them. No app-imposed "recommended" values.
- No streaks, no trophies, no badges, no fire emojis on completion.
- Sleep tracking specifically must not moralize about late bedtimes. If he goes to bed at 3am five nights in a row, the app says "Slept 5h on avg this week" — not "Try going to bed earlier."
- Low mood scores must not trigger any auto-suggestion about mental health, therapy, hotlines, or coping strategies. We are not qualified to be that. Just record and display.
- Procrastination help is via hard deadlines, not pomodoro or study-break nudges. Skip any "you've been on the app for 50min, take a break" feature in this phase. The master brief mentioned it but it's the wrong fit for this user.

Keep all health copy under the read-aloud test that the Money module passes — but the bar is higher here.

---

## 3. Pre-flight

- The `HabitLog` model already exists in `prisma/schema.prisma`: one row per day per user with fields `sleepHours`, `exerciseMinutes`, `mealsLogged`, `waterGlasses`, `mood (1–5)`, `notes`. We'll use it as the daily aggregate; per-session detail (for exercise) lives in a new `ExerciseSession` model.
- The `ExercisePlan` model also exists from Phase 1. **Leave it untouched in this phase.** We don't need structured weekly plans; just a single target minutes-per-week on `User`. ExercisePlan can be filled in later if structured plans become useful.
- All dates handled in user's timezone. `HabitLog.date` is a date-only value (`@db.Date` in Postgres, `DateTime` in SQLite — match what the schema currently does).
- The unified Reminder system from Phase 4C handles the wind-down reminder as a new `kind`. Plug into `src/lib/reminders/`, don't fork.

---

## 4. Schema additions

### New model: `ExerciseSession`

```prisma
model ExerciseSession {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activity   String                              // free text — "Running", "Gym", "Yoga", "Football"
  minutes    Int
  occurredAt DateTime                            // when the session happened (date is the meaningful part)
  notes      String?
  createdAt  DateTime @default(now())
  @@index([userId, occurredAt])
}
```

`HabitLog.exerciseMinutes` becomes **derived** — sum of `ExerciseSession.minutes` for that user on that date. Don't store it separately; recompute when needed. (You can leave the field in the schema for backwards compatibility but stop writing to it. Or drop it and migrate — propose either approach.)

### Extend `User` with health preferences

```prisma
model User {
  // ... existing ...

  // Exercise target
  weeklyExerciseTargetMinutes Int      @default(90)

  // Sleep
  sleepTargetHours            Float?                       // optional; null means "no target set"
  targetBedtime               String?                      // "HH:mm" 24h, e.g., "01:30" — yes, he's a night owl
  windDownEnabled             Boolean  @default(false)
  windDownMinutesBefore       Int      @default(30)
  lastWindDownDismissedOn     DateTime?                    // date-only; used to dedupe daily banner

  // Mood preference: no fields yet beyond what's on HabitLog
}
```

Migration: `<ts>_health_module`.

---

## 5. Sub-phase ordering

Ship and verify in this order. Each demo + sign-off before next.

### 5A — Exercise

- Page section "Exercise" at `/health`.
- "Add session" button → form: activity (text), minutes (int), date (default today), notes (optional).
- List of recent sessions, grouped by day, sorted desc.
- Weekly target editor (default 90, persisted on User).
- Weekly progress bar: this week's total minutes (Mon–Sun in user's tz) vs target. Color: stone <50%, soft amber at target, stone again >target. No celebratory color.
- Caption beneath bar: "32 of 90 min this week" — neutral.
- Empty state: "No sessions yet — log one when you've got a sec."

Server actions: `createSession`, `updateSession`, `deleteSession`, `setWeeklyTarget`.

**Checkpoint 5A:** user can log 3–4 sessions, see them grouped, see the progress bar fill. Demo + sign-off.

---

### 5B — Sleep

- Page section "Sleep".
- "Log sleep" button → form with two input modes (toggle):
  - **Hours**: single decimal input ("How many hours?").
  - **Bedtime + wake time**: two time inputs; derives hours on submit (handles crossing midnight).
- Date defaults today. Editing an existing day's HabitLog upserts on `(userId, date)`.
- 7-day average display.
- Small Recharts bar chart: last 14 nights, bars colored stone, target line shown only if `sleepTargetHours` is set.
- Sleep target editor (optional, can stay null).
- Wind-down reminder controls:
  - Toggle for `windDownEnabled` (default off).
  - Bedtime input (`HH:mm`).
  - Minutes-before input (default 30).
  - Helper text: "We'll show a small banner on your dashboard that many minutes before your target bedtime — no notifications, no sound, dismissable per day."
- Empty state: "No sleep logged yet."

Server actions: `logSleep(date, hours OR bedtime+wake)`, `setSleepTarget`, `setWindDownPrefs`.

Wind-down banner rendering (read-on-demand pattern, no cron):
- On dashboard load: if `windDownEnabled = true`, compute the wind-down window in user's tz: `[targetBedtime - windDownMinutesBefore, targetBedtime]`. If `now` falls inside that window AND `lastWindDownDismissedOn !== today (user tz)`, render the banner.
- Banner copy: "Wind-down time — bed in {N} min." Single neutral line. No emoji. Dismiss button sets `lastWindDownDismissedOn = today`.
- This is a new `kind` in `src/lib/reminders/` — even though it doesn't persist a row, the rendering goes through the same banner stack so it looks consistent with task/bill reminders.

**Checkpoint 5B:** user can log sleep three ways (hours, bedtime+wake, edit existing), see the chart, toggle wind-down on with a 1:30 target → next dashboard load within window shows the banner; dismissal sticks until tomorrow. Demo + sign-off.

---

### 5C — Nutrition

- Page section "Nutrition".
- Two small counters: **Water glasses today** and **Meals logged today**. Each with `+` and `−` buttons that update `HabitLog.waterGlasses` / `HabitLog.mealsLogged` for today's row. No targets shown, no goals — just counts.
- Optional one-line note input for today.
- Small "Past 7 days" mini-grid showing each day's counts (compact dots/numbers, not a chart).
- Empty/zero state on counters: just `0` — don't render "log your first glass!" copy.

Server actions: `bumpWater(delta: ±1)`, `bumpMeals(delta: ±1)`, `setDailyNote(date, text)`.

Important: water/meals are **counts only**, no per-item detail. No calories, no portion sizes, no food database. The brief is explicit about this and it's right — anything more turns this into a different app.

**Checkpoint 5C:** user can bump counters up/down, add a note, see the past 7 days. Demo + sign-off.

---

### 5D — Mood & habits

- Page section "Mood & habits".
- Today's check-in: 5 buttons (1–5) rendered as a horizontal scale with neutral labels — e.g., "1 rough · 2 low · 3 ok · 4 good · 5 great". Subtle, no faces, no emoji. Selecting a button sets `HabitLog.mood` for today. Editable any time during the day.
- Optional one-line note (shared field with Nutrition's daily note, or separate — see implementation note below).
- 14-day mood trendline: Recharts `LineChart`, Y-axis 1–5, X-axis dates. Dots colored stone uniformly; no gradient, no green-for-high. Gap handling: if a day has no entry, the line breaks (don't interpolate).
- Caption beneath: "14-day average: 3.4". Just the number, no commentary.

Server action: `setMood(date, score)`, `setDailyNote(date, text)` (shared with 5C).

Implementation note on the daily note: `HabitLog.notes` is a single text field per day. If 5C and 5D both want to surface a "daily note" input, they should write to the same field. Pick one section to render the editor and have the other show it read-only with a link, OR show both editors and accept that the latest write wins (with a small "syncs to today's note" hint). Either is fine; flag the choice in the plan.

**Crucial tone rule for this section:** if the user logs `1` or `2` for multiple consecutive days, **do nothing**. No banner. No suggestion. No "consider talking to someone." We surface the user's own data and step out of the way.

**Checkpoint 5D:** user logs mood for 3+ days, sees the trendline, low scores don't trigger any prompts. Demo + sign-off.

---

### 5E — Dashboard "Health this week" card

Wire the dashboard placeholder to real data:

1. **Sleep**: 7-day average hours, formatted as "6.2h avg". If `sleepTargetHours` is set, show "of 7h target" alongside. Neutral. No "below target" callout.
2. **Exercise**: this week's minutes vs `weeklyExerciseTargetMinutes`. Small progress bar, same styling as 5A.
3. **Mood**: a 14-day mini-trendline (Recharts sparkline-style, no axes, ~80px wide). Below it: latest mood number.
4. **Log today** button → routes to `/health` with a hash anchoring to the most-relevant section (probably Mood since that's the most-likely-untouched daily entry).

Don't show hydration/meal counts on the dashboard card — they live on `/health`. Keeping the dashboard card scannable matters more than showing every metric.

If the user hasn't logged anything for any section, the card renders empty states cleanly: "No sleep logged this week", "No sessions yet", "No mood entries". Don't hide the card; the empty state itself is informative.

**Checkpoint 5E:** dashboard card reflects all the health data. Demo + sign-off.

---

## 6. Tone — examples per section

- **Exercise empty**: "No sessions yet — log one when you've got a sec."
- **Exercise progress**: "32 of 90 min this week."
- **Exercise target reached**: "92 of 90 min this week." (No fanfare. The number is the reward.)
- **Sleep empty**: "No sleep logged yet."
- **Sleep average**: "6.2h avg over the last 7 nights."
- **Wind-down banner**: "Wind-down time — bed in 30 min."
- **Wind-down dismissed**: no toast, banner just disappears.
- **Nutrition counters**: just numbers next to icons. No copy.
- **Daily note empty**: "Add a note for today" placeholder.
- **Mood scale labels**: "1 rough · 2 low · 3 ok · 4 good · 5 great" — neutral words, no faces.
- **Mood post-log toast**: "Logged."
- **Mood trendline caption**: "14-day average: 3.4."
- **Health dashboard card empty**: "No health logged this week — head to Health to start."

Forbidden patterns (do not ship anything that pattern-matches these):
- Any emoji on completion of a log action (no 🎉🔥💪).
- Any "great job!", "awesome!", "you crushed it" language.
- Any suggestion to sleep earlier, exercise more, eat better, drink more water, or be in a better mood.
- Any reference to "recommended" values from health authorities.
- Any "we noticed you've been..." patterns following multi-day patterns.
- Streaks, badges, trophies, "X days in a row" framings.

---

## 7. Acceptance criteria

Phase 5 is "done" when:

- [ ] Migration `<ts>_health_module` runs cleanly.
- [ ] `/health` renders with four sections, 375px responsive.
- [ ] User can log multiple exercise sessions in a day; HabitLog.exerciseMinutes is correctly derived (or removed) per the chosen approach.
- [ ] Weekly exercise total resets correctly on Monday in user's tz.
- [ ] User can log sleep three ways (hours-only, bedtime+wake with same-day, bedtime+wake crossing midnight); derived hours match expectations.
- [ ] Sleep chart renders 14 nights; breaks in line for missing days.
- [ ] Wind-down banner appears only in the configured window, only when enabled, and dismissal sticks until tomorrow in user's tz.
- [ ] Hydration and meal counters update HabitLog correctly with `+`/`−` buttons; never go negative.
- [ ] Daily note edits write to `HabitLog.notes` for the correct date.
- [ ] Mood scale renders neutral labels with no faces/emoji; selecting a button persists.
- [ ] Mood trendline renders 14 days with gaps for missing entries; uses uniform color.
- [ ] Multi-day low mood logs do NOT trigger any banner, prompt, or auto-suggestion.
- [ ] Dashboard "Health this week" card shows sleep avg, exercise progress, mood mini-trendline, with working "Log today" link.
- [ ] All health copy passes the read-aloud test (especially the empty/target-reached states).
- [ ] `npx tsc --noEmit` and `npx next build` clean.

---

## 8. Don't deviate without asking

Stop and ask before:
- Adding a paid dependency (none needed; Recharts + date-fns already cover everything).
- Adding any biometric or external-app integration (Apple Health, Google Fit, Fitbit, Strava, etc.).
- Adding calorie/macro tracking, food databases, weight tracking.
- Adding "study break" prompts based on app activity.
- Adding any auto-suggestion based on mood, sleep, or exercise patterns.
- Adding streaks, badges, trophies, or any gamification.
- Implementing the wind-down reminder via a cron job — keep it read-on-demand like every other reminder in the app.
- Filling out the `ExercisePlan` model for v1 — leave it unused.
- Using faces, emoji, or color-coded gradients on the mood scale.
- Hard-coding "recommended" sleep/exercise/hydration values from health guidelines.

After each sub-phase (5A–5E): demo, walk through the empty states + populated states + tone of every new string, ask the user to verify, get sign-off before continuing. After 5E, walk through the dashboard with all four sections populated and confirm the whole picture renders cleanly.

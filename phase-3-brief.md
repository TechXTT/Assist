# Phase 3 Brief — Google Calendar Integration

> Paste this into Claude Code as a new turn. Read it end-to-end, propose a plan with file additions and any schema deltas, confirm with the user, then implement. Phases 1 + 2 are done and verified.

---

## 1. What this phase delivers

By the end of Phase 3, the user can:

1. Have his real Google Calendar events appear in the **Today** section of `/dashboard`, merged chronologically with tasks due today.
2. See his connected Google account on `/settings`, including last sync time and a manual "Sync now" button.
3. Disconnect the Google account from `/settings` (clears stored tokens and local event cache).
4. Trust that events stay reasonably fresh — the dashboard auto-syncs when the cached events are >15 minutes old.

Out of scope for Phase 3: creating/editing/deleting events, multi-calendar selection, a dedicated `/calendar` page, all-day-event-only views, attendee management, free/busy lookups. Read-only sync of the user's primary calendar only.

---

## 2. Pre-flight

- OAuth scopes are already configured in Phase 1: `openid email profile calendar.readonly gmail.readonly`. Do not change them in this phase. Gmail stays untouched here — that's Phase 4.
- The `Account` table (NextAuth Prisma adapter) already stores `access_token`, `refresh_token`, and `expires_at` (or `expires_in`, depending on adapter version). **Verify which fields exist** before writing the refresh helper, and don't add new fields to `Account` — it's NextAuth-managed.
- The `CalendarEvent` model already has: `id, userId, googleEventId (unique), title, startsAt, endsAt, location, description, lastSyncedAt`. Add fields per §4 — those are pre-authorized.
- All times stay UTC in DB, render in user's local tz (browser detection, env fallback). Google returns ISO-8601 with timezone — parse with `date-fns` / `date-fns-tz`.
- No cron. Sync is read-on-demand, same pattern as Phase 2 reminders.

---

## 3. Library choice

Use `googleapis` (the official Node SDK). It handles OAuth token refresh, pagination, and incremental sync cleanly. Alternatives like raw `fetch` + REST work but mean reinventing the auth client — not worth it for one phase.

```bash
npm install googleapis
```

That's the only new dependency for Phase 3. If you want anything else, ask first.

---

## 4. Schema additions (pre-authorized)

Add to `CalendarEvent`:
- `allDay Boolean @default(false)` — Google distinguishes `date` vs `dateTime`; we need this to render correctly.
- `htmlLink String?` — Google's link to the event in the user's calendar UI; opens in new tab when user clicks the event.
- `status String @default("confirmed")` — values are `confirmed | tentative | cancelled`. Filter out `cancelled` from the dashboard.
- `timeZone String?` — Google's per-event tz; store for fidelity even though we render in user-local.

Add to `User`:
- `lastCalendarSyncAt DateTime?` — used to decide if a fresh sync is needed (>15min stale → resync). Storing on User (not on each event) handles the empty-calendar case where there are zero `CalendarEvent` rows but we've successfully synced.

New migration: `<ts>_calendar_event_extras`. No other schema changes.

---

## 5. Google API integration

### Token refresh helper

NextAuth v4's Google provider stores the refresh token on first sign-in but does **not** automatically refresh access tokens for you. Build a server-side helper:

```
src/lib/google/auth.ts
  getValidAccessToken(userId: string): Promise<string>
  disconnectGoogle(userId: string): Promise<void>
```

Behavior of `getValidAccessToken`:
1. Fetch the user's `Account` row where `provider = "google"`.
2. If missing → throw `NotConnectedError`.
3. If `expires_at * 1000 - 60_000 > Date.now()` (still valid with 1-min margin) → return current `access_token`.
4. Otherwise, POST to Google's token endpoint with `grant_type=refresh_token` and the stored `refresh_token`. On success, persist new `access_token` + `expires_at` and return.
5. If refresh fails (token revoked, etc.) → clear the row's `access_token` (keep refresh_token in case it's transient) and throw `ReauthRequiredError`.

`disconnectGoogle`: delete the Account row, delete all CalendarEvent rows for that user, null out `User.lastCalendarSyncAt`.

### Calendar wrapper

```
src/lib/google/calendar.ts
  listEvents(userId: string, opts: { rangeStart: Date, rangeEnd: Date }): Promise<NormalizedEvent[]>
```

Implementation:
1. `getValidAccessToken(userId)`.
2. Construct an `OAuth2Client` with the access token (no refresh needed at this layer — the helper above already handled it).
3. Call `calendar.events.list` on the **primary** calendar with: `singleEvents=true` (expands recurring), `orderBy=startTime`, `timeMin=rangeStart.toISOString()`, `timeMax=rangeEnd.toISOString()`, `maxResults=2500` (Google's per-page max), paginate via `pageToken` if needed.
4. Normalize each event to a flat shape: `{ googleEventId, title, startsAt, endsAt, allDay, location, description, htmlLink, status, timeZone }`. Convert `date`-style all-day events to UTC midnight bounds.
5. Return the flat list. Caller persists.

Error mapping: 401 → trigger token refresh once and retry; second 401 → throw `ReauthRequiredError`. 403 with `quotaExceeded` → backoff + retry once. Other errors bubble up.

---

## 6. Sync algorithm (window-based, simple)

In `src/lib/google/sync.ts`:

```
syncCalendar(userId: string): Promise<{ added: number, updated: number, removed: number }>
```

1. Define window: `rangeStart = startOfDay(now) - 1 day`, `rangeEnd = startOfDay(now) + 30 days`. Anything outside this window is irrelevant for the current dashboard.
2. `listEvents(userId, { rangeStart, rangeEnd })` → array of normalized events from Google.
3. Fetch all `CalendarEvent` rows where `userId = ... AND startsAt < rangeEnd AND endsAt > rangeStart` (the local cache for that window).
4. **Upsert** by `googleEventId`: insert new ones, update changed ones (compare title/start/end/location/status). Set `lastSyncedAt = now()` on all upserted rows.
5. **Detect deletions**: any row in the local cache for this window whose `googleEventId` did NOT appear in the Google response → delete it. (Cancelled events also pass through here since Google still returns them with `status=cancelled`; either delete them or keep them and filter at render time. Pick one and stick with it — recommend filter-at-render so we don't churn the DB on tentative cancellations.)
6. Update `User.lastCalendarSyncAt = now()`.
7. Return counts for logging/UX.

Don't bother with Google's `syncToken` incremental API in this phase. It's a meaningful win at scale; for a single user with hundreds of events in a 31-day window, the full window pull is fast and simpler. We can layer it in later if sync becomes slow.

---

## 7. Sync trigger (read-on-demand)

In `src/app/(app)/dashboard/page.tsx` (and anywhere else that displays calendar events), the page server component:

1. Reads `User.lastCalendarSyncAt`.
2. If it's null OR older than 15 minutes ago → `await syncCalendar(userId)` before reading events. Catch `ReauthRequiredError` and show a "reconnect Google" banner instead of crashing.
3. If fresh → skip sync, read directly from DB.

This keeps the dashboard fast on hot loads and self-heals on stale ones. The 15-minute threshold is configurable via env (`CALENDAR_SYNC_STALENESS_MINUTES`, default 15) so we can tune later.

Add a "Sync now" button on `/settings` that calls a server action wrapping `syncCalendar(userId)` and revalidates `/dashboard` and `/settings`.

---

## 8. Settings page wiring (`/settings`)

Replace the placeholder with a real "Connections" section:

- **Google** card showing:
  - Connected account email (from session.user.email).
  - Last sync time, formatted as relative ("2 minutes ago", "Never").
  - "Sync now" button (server action; shows toast with counts on success — "Synced — 3 added, 1 updated, 0 removed").
  - "Disconnect" button → opens an `AlertDialog`: "Disconnect Google? Your synced events will be removed from the dashboard." Confirm → calls `disconnectGoogle(userId)` → toast → revalidate.
- A **Reconnection prompt** banner above the card if the most recent sync attempt threw `ReauthRequiredError` (set a flag in session or User model — simplest is a `User.googleNeedsReauth: Boolean @default(false)` field, also pre-authorized).

Keep tone friendly: "We'll forget your calendar until you reconnect — no worries." not "ERROR: Authentication required."

---

## 9. Dashboard wiring (`/dashboard` Today section)

The "Today" section currently shows tasks due today (from Phase 2). Now merge in calendar events:

1. Fetch `CalendarEvent` rows where the event's local-day overlaps with today's local-day, AND `status != "cancelled"`.
2. Merge with today's tasks, sort by start time:
   - Tasks have `dueAt` → use that as their sort time.
   - Events have `startsAt` → use that.
   - All-day events sort to the top of the day with an "All day" label.
3. Render as a unified list with a small icon distinguishing event vs task (calendar glyph vs check-circle from `lucide-react`).
4. Event rows show: title, time range ("10:00 AM – 11:30 AM" or "All day"), location if present (with map-pin icon), and click → opens `htmlLink` in a new tab.
5. Task rows keep their existing rendering.
6. Empty state when both are empty: "Nothing on the schedule. Free as a bird 🕊️" (single emoji, opt-in).

The "Deadlines this week" section remains tasks-only — events aren't deadlines.

---

## 10. Error handling

- **Token revoked** (user rotated their Google password, removed app permissions, etc.): `ReauthRequiredError` → set `User.googleNeedsReauth = true` → render the reconnect banner. Don't keep retrying the failed token.
- **Network error / 5xx from Google**: log and continue with cached events. Don't block the dashboard render. Show a small "Couldn't sync — using cached events" toast or inline notice.
- **Quota exceeded**: backoff helper in the wrapper handles one retry. Beyond that, treat as transient — same UX as network error.
- **No connected account**: `/dashboard` and `/settings` should both render fine, just without events. Settings shows "Connect Google" CTA in place of the connected account card. (For the single-user app this should rarely happen — they connected in Phase 1 — but handle the empty case anyway.)

---

## 11. Acceptance criteria

Phase 3 is done when:

- [ ] `npm install googleapis` is the only new dependency.
- [ ] Migration `<ts>_calendar_event_extras` adds the four CalendarEvent fields + `User.lastCalendarSyncAt` + `User.googleNeedsReauth`.
- [ ] First load of `/dashboard` after a fresh DB triggers a sync, populates `CalendarEvent` rows, and renders today's events in the Today section.
- [ ] Reload within 15 minutes does NOT trigger a sync (verifiable in server logs or via an obvious console.log during dev).
- [ ] Reload after 15+ minutes triggers a re-sync.
- [ ] Adding an event in Google Calendar UI → "Sync now" on `/settings` → event appears on dashboard within seconds.
- [ ] Deleting an event in Google → next sync removes it from the dashboard.
- [ ] All-day events render with "All day" label and sort to the top of today.
- [ ] Recurring events appear as individual instances in the window, not as a single master event.
- [ ] Event click opens `htmlLink` in a new tab.
- [ ] `/settings` shows connected email, last sync time, working "Sync now" button, working "Disconnect" with confirm dialog.
- [ ] After disconnect: dashboard renders cleanly (no events, no errors), settings shows "Connect Google" state.
- [ ] After token expiry (manually invalidate by editing access_token in Studio to garbage), next sync should refresh via refresh_token transparently — verifiable by watching the access_token change in Studio.
- [ ] After revoking access in https://myaccount.google.com/permissions, next sync sets `googleNeedsReauth = true` and shows the reconnect banner; doesn't crash.
- [ ] `npx tsc --noEmit` and `npx next build` pass clean.
- [ ] Mobile (375px) check on `/dashboard` and `/settings`.

---

## 12. Don't deviate without asking

Stop and ask before:
- Adding a paid dependency.
- Adding a new schema field beyond §4's authorized list.
- Implementing Google's incremental `syncToken` API in this phase (do it later).
- Building a `/calendar` route or any view beyond the dashboard's Today section.
- Touching Gmail in any way (Phase 4).
- Adding a real cron job (we're staying read-on-demand).
- Modifying the OAuth scopes already configured in Phase 1.

Match the friendly-casual tone — error states especially. The user is a procrastinator on a tight budget; an alarmist "AUTHENTICATION FAILED" banner triggers exactly the wrong response. "Looks like Google forgot us — quick reconnect?" is the register.

After implementation: demo on `/dashboard` and `/settings`, walk through the disconnect/reconnect dance, and ask the user to verify before declaring Phase 3 done.

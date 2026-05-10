# Phase 3 Addendum — Multi-Calendar Sync

> Paste this into Claude Code as a follow-up to Phase 3. Read end-to-end, propose plan, confirm, implement. Phase 3 is shipped and works for the primary calendar only — this addendum extends sync to all of the user's Google Calendars with per-calendar toggles in settings.

---

## 1. What this addendum delivers

After this lands:

1. The dashboard's Today section shows events from **all of the user's Google Calendars** that they have visible in Google Calendar UI (school timetable, holidays, shared calendars, etc.) — not just the primary.
2. `/settings` shows a **Calendars** subsection listing every calendar the user has access to, with a per-calendar toggle to enable/disable sync.
3. Toggling a calendar off removes its events from the dashboard immediately and stops syncing it on future runs.
4. The default for newly-discovered calendars is "selected if Google considers it selected" (matches what's currently visible in the user's Google Calendar UI).

Out of scope: per-calendar color-coding on dashboard events (defer to polish phase), shared/secondary calendar write access, calendar-specific staleness windows.

---

## 2. Schema changes

### New model: `Calendar`

```prisma
model Calendar {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  googleCalendarId String   // e.g. "user@gmail.com" (primary), "...@group.calendar.google.com" (others)
  summary          String   // display name from Google
  description      String?
  backgroundColor  String?  // hex from Google
  foregroundColor  String?
  primary          Boolean  @default(false)
  syncEnabled      Boolean  @default(true)  // user's choice — drives whether we sync this one
  accessRole       String?  // owner | writer | reader | freeBusyReader
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  events           CalendarEvent[]
  @@unique([userId, googleCalendarId])
}
```

### Changes to `CalendarEvent`

- Add `calendarId String` (foreign key to `Calendar`).
- Add relation `calendar Calendar @relation(fields: [calendarId], references: [id], onDelete: Cascade)`.
- **Replace** the existing `@unique` on `googleEventId` with `@@unique([calendarId, googleEventId])` — same event id can legitimately exist in different calendars.

### Migration strategy

Existing `CalendarEvent` rows from Phase 3 have no `calendarId`. Cleanest path:

1. Create the `Calendar` table.
2. Add `calendarId` column to `CalendarEvent` as nullable temporarily.
3. In a data migration step (or just a startup-time cleanup), delete all existing `CalendarEvent` rows — they're cache data, the next sync will repopulate from scratch.
4. Make `calendarId` NOT NULL.
5. Add the new unique constraint, drop the old one.

Name the migration `<ts>_multi_calendar_support`. Test the migration by running it against a populated dev DB and confirming `npm run dev` survives.

---

## 3. Calendar list API

New helper in `src/lib/google/calendar.ts`:

```
listCalendars(userId: string): Promise<NormalizedCalendar[]>
```

Calls `calendar.calendarList.list` (no pagination needed in practice — users rarely have >250 calendars). Normalize each returned calendar to:

```ts
type NormalizedCalendar = {
  googleCalendarId: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary: boolean;
  selected: boolean;       // Google's "is it visible in user's UI" flag
  accessRole: string;
};
```

Same auth pattern as `listEvents` — uses `getValidAccessToken`, handles 401/403 the same way.

---

## 4. Sync algorithm changes

`syncCalendar(userId)` in `src/lib/google/sync.ts` becomes a two-step process:

### Step A — Sync calendar list
1. `listCalendars(userId)`.
2. Upsert each into local `Calendar` table by `(userId, googleCalendarId)`.
3. For **newly-discovered** calendars (not seen before locally): set `syncEnabled = calendar.selected` so we default-match Google's visibility. For **already-known** calendars: don't touch `syncEnabled` — that's the user's choice now, not Google's.
4. Optional: delete local `Calendar` rows whose `googleCalendarId` no longer appears in the response (user removed it). Cascade-delete their events.

### Step B — Sync events per enabled calendar
1. Query `Calendar` rows where `userId = ... AND syncEnabled = true`.
2. For each, call `listEvents` with `calendarId = googleCalendarId` (parameterize the existing helper to accept calendar id; default still primary if nothing passed).
3. Apply the same window-based upsert + delete logic per calendar.
4. Aggregate counts across calendars.
5. Update `User.lastCalendarSyncAt = now()` once at the end.

Return shape becomes:
```ts
{ added: number, updated: number, removed: number, calendarsSynced: number }
```

### When user toggles `syncEnabled`
Server action `setCalendarSyncEnabled(calendarId, enabled)`:
- Updates the row.
- If turning OFF: cascade-delete that calendar's events from the local cache so the dashboard updates immediately.
- If turning ON: trigger a sync of just that calendar (don't make the user wait for the global staleness window).
- Revalidate `/dashboard` and `/settings`.

---

## 5. Settings UI changes

In the existing `/settings` Connections card, add a **Calendars** subsection beneath the Google connection info:

- Header: "Calendars" with a small description: "Toggle which calendars show up on your dashboard."
- A scrolling list of all `Calendar` rows for the user, ordered by `primary DESC, summary ASC`.
- Each row:
  - A small color dot (using `backgroundColor`).
  - Calendar `summary` (truncated if long).
  - "Primary" badge next to the primary calendar.
  - Toggle switch on the right (shadcn `Switch` component) bound to `syncEnabled`.
  - Small subtitle showing access role for non-primary ("owner", "reader", etc.) — quietly informative.
- Toggling triggers the server action above; show a small toast confirming ("Hidden — Holidays" / "Showing — Holidays").

If the calendar list hasn't been fetched yet (fresh DB), show "Loading your calendars..." and trigger a sync. After the sync, render the list.

---

## 6. Dashboard rendering

No major changes — events from all enabled calendars merge into the same Today list. Skip per-event color-coding for now; it can come in the polish pass.

The empty state stays the same. The "Couldn't reach Google" transient banner stays the same. The reauth banner stays the same.

---

## 7. Acceptance criteria

This addendum is done when:

- [ ] Migration `<ts>_multi_calendar_support` runs cleanly; existing event rows are wiped and repopulate on next sync.
- [ ] First sync after migration creates a `Calendar` row for every calendar in the user's Google account.
- [ ] Newly-discovered calendars default to `syncEnabled = google.selected` (i.e., match what's currently visible in Google Calendar UI).
- [ ] Dashboard Today section shows events from **multiple** calendars at once (verify with a non-primary event happening today).
- [ ] `/settings` Calendars list shows all calendars with toggles and the primary clearly marked.
- [ ] Toggling a calendar OFF immediately removes its events from the dashboard (verify via Studio + reload).
- [ ] Toggling a calendar back ON re-syncs just that calendar and its events reappear.
- [ ] A calendar removed in the user's Google account also disappears from `/settings` after the next sync (and its events are gone).
- [ ] `Sync now` toast count includes events across all enabled calendars.
- [ ] Disconnect → reconnect cycle still works; calendars repopulate.
- [ ] `npx tsc --noEmit` and `npx next build` both clean.
- [ ] 375px responsive check on `/settings` — the calendar list should scroll cleanly with toggles staying tappable.

---

## 8. Don't deviate without asking

- Don't add per-event color rendering on dashboard yet — defer to polish.
- Don't fetch `freeBusy` info or attendees.
- Don't add a calendar-creation flow — read-only stays read-only.
- Don't add cron — staleness check + manual sync still apply, now across all enabled calendars.
- Don't change existing OAuth scopes (`calendar.readonly` already covers `calendarList.list`).
- Don't introduce new dependencies. `googleapis` from Phase 3 covers everything.

After implementation: demo on `/dashboard` with multi-calendar events visible, and on `/settings` toggle a calendar off and on. Ask the user to verify before declaring this done.

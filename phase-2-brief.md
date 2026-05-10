# Phase 2 Brief — Tasks & Deadline Pressure Engine

> Paste this into Claude Code as a new turn. Read it end-to-end before writing code, propose a plan with file tree + any schema additions, confirm with the user, then implement. Phase 1 is done and verified; the Prisma schema, auth gate, and 7 placeholder routes are already in place.

---

## 1. What this phase delivers

By the end of Phase 2, the user can:

1. Open `/tasks` and see a kanban-lite board (Todo / Doing / Done) with all his tasks.
2. Add, edit, complete, and delete tasks via UI (no SQL).
3. See live, color-coded countdowns on every task with a deadline.
4. See escalating reminder banners on `/dashboard` and `/tasks` as deadlines approach.
5. Get a "first tiny step" suggestion on stalled tasks (template-driven for now — AI comes in Phase 6).
6. See the dashboard's **Today** and **Deadlines this week** sections wired up with real data.

Out of scope for Phase 2: Google Calendar sync (Phase 3), AI text generation, email notifications, sub-tasks, recurring tasks, tags, attachments.

---

## 2. Pre-flight

- The `Task` and `Reminder` models already exist in `prisma/schema.prisma`. **Use them as-is.** If you want to add a field, propose it first — do not rename or remove anything.
- All times are UTC in DB, rendered in the user's local timezone (browser `Intl.DateTimeFormat().resolvedOptions().timeZone`, fallback to env default).
- Money is irrelevant in this phase — leave Money/Health placeholders untouched.
- Default to Server Actions for mutations (Next App Router idiom). Use `revalidatePath` after writes.
- Form validation: Zod + react-hook-form via shadcn's form components.

---

## 3. The Task model — behavior contract

Re-read the Task fields in `schema.prisma`. Behavior:

- **Required on create**: `title`. Everything else is optional.
- **Defaults**: `priority = "med"`, `status = "todo"`, `source = "manual"`.
- **`dueAt`**: optional. If present, drives countdowns and reminder generation. If absent, the task shows in Todo with no countdown and never generates reminders.
- **Status transitions**: `todo → doing → done` is the canonical flow, but the user can move between any two states freely (drag a card, or use a status dropdown). Moving to `done` sets `completedAt = now()`. Moving away from `done` clears `completedAt` and clears any "early ✓" annotation.
- **`tinyFirstStep`**: nullable string. Populated by the deadline pressure engine on stalled tasks (see §5). Cleared automatically when the user moves the task to `doing` or `done`, or edits the title.
- **`updatedAt`** (auto via Prisma `@updatedAt`): used as the "last touched" signal for stall detection. If your schema didn't already have `@updatedAt` on `Task`, add it now — this is the one schema tweak I'm authorizing without asking.

### Edit & delete
- Edit: title, description, dueAt, priority. Status changes have their own UI (drag/dropdown) so they don't go through the edit form.
- Delete: soft-confirm modal ("Delete this task? This can't be undone."). Hard delete from DB — no soft-delete in v1.

---

## 4. The Reminder system — design (read this carefully)

The brief specifies four reminder levels per task: **gentle** (7 days before due), **firm** (2 days), **urgent** (12 hours), **final** (1 hour). Implement as **read-on-demand**, not push.

### Why read-on-demand
Vercel hobby-plan cron jobs are limited (and we're free-tier-only). Live push notifications aren't in scope. So:

1. A lightweight **generator** (server action, runs on every task create/update with a `dueAt`) computes the four `Reminder` rows for that task with their respective `fireAt` timestamps. If a row already exists at that level for the task, update its `fireAt`; otherwise insert.
2. The **dashboard and /tasks** query for reminders where `fireAt <= now()` AND `sentAt IS NULL` AND the parent task is not `done`. They surface as banners.
3. When the user views or dismisses a reminder, set `sentAt = now()` so it doesn't re-surface. Dismiss is a per-reminder UI action.
4. If the user deletes a task or completes it, delete (or null) all its pending reminders.

This means we don't need a cron at all for reminders in Phase 2. Don't add one — it's wasted complexity.

### Reminder UI
- **On `/dashboard`**: a stacked banner area near the top, showing up to 3 active reminders (most-urgent first, by level then by `fireAt`). Each banner: small color stripe (gentle = stone, firm = amber, urgent = orange, final = red), task title, "X hours/days left", a "Dismiss" button, and the task title links to the task detail.
- **On `/tasks`**: each task card with active reminders shows a small badge ("⏰ 12h left" — minimal emoji is fine here, single emoji only, opt-in to the user's tone).
- **Tone of reminder copy**: friendly. "Heads up — Linear Algebra problem set is due in 2 days." not "REMINDER: Task overdue."

---

## 5. Tiny First Step (template-driven)

Trigger: a task qualifies if **all** of:
- `status === "todo"`
- `dueAt` is not null and `dueAt - now()` is between 0 and 14 days
- `updatedAt` is more than 3 days old (i.e., the user hasn't touched it)
- `tinyFirstStep` is currently null

Computation runs lazily — when the user loads `/dashboard` or `/tasks`, evaluate any visible Todo tasks and populate `tinyFirstStep` for those that qualify. Don't bulk-process the whole DB.

### Template generator
Hardcode an array of 8–12 generic templates that work for any task. Pick deterministically by hashing `task.id` so the same task gets the same suggestion across reloads. Examples:

- "Open the relevant doc/note and write one sentence — that's it."
- "Set a 5-minute timer and just look at the task. You don't have to start."
- "Break it into 3 sub-points in your head. No commitment beyond that."
- "Tell yourself you'll do it for 10 minutes, then stop if you want."
- "Find the first thing you'd Google about this task. Google it now."
- "Open the file/app you'd need. That's the whole step."
- (etc.)

Display: small italic block under the task title on `/tasks` task detail and on dashboard's "Deadlines this week" hover/expand. Tone: casual, low pressure — these are anti-paralysis nudges, not commands.

When the user advances the task out of Todo (or edits its title), clear `tinyFirstStep`.

---

## 6. Tasks page UI (`/tasks`)

### Layout
- **Desktop (≥md)**: three columns side-by-side — Todo, Doing, Done. Cards stack vertically within columns. Drag-and-drop between columns updates `status`. Use `@dnd-kit/core` (small, free, accessible) — not react-beautiful-dnd (deprecated).
- **Mobile (<md)**: single list view with status filter chips at top (`All / Todo / Doing / Done`, default `Todo`). Long-press or tap-and-hold opens a status switcher; no drag on mobile.

### Card content
- Title (truncate at 2 lines).
- Priority dot (color-coded: low = stone, med = amber, high = red).
- Due indicator: "due in 3d" / "due in 5h" / "overdue 2d" (color-coded same as the deadline scale: green > 5d, amber 2–5d, red < 2d, dark-red overdue).
- Active reminder badge (only if any reminder is active).
- Click card → opens detail sheet (right-side drawer on desktop, bottom sheet on mobile) with full description, edit button, delete button, status switcher, tiny-first-step block.

### Add Task button
Top-right of the page. Opens a modal with: title (required), description (textarea, optional), due date/time (datetime-local input, optional), priority (radio: low/med/high, default med). Submit creates the task, generates reminders, closes the modal, and shows a small toast ("Added — see you Monday on this one").

### Empty states
- Empty board: "Nothing in your queue. Add a task to get started." with the Add button highlighted.
- Empty Doing column: "Nothing in flight."
- Empty Done column: "Nothing done yet — that's OK."

---

## 7. Dashboard wiring (`/dashboard`)

Replace the placeholder cards for the **Today** and **Deadlines this week** sections with real data. Leave the other dashboard sections (Money this month, Health this week) as placeholders — they're for later phases.

### "Today" section
Shows tasks where `dueAt` falls within today's local date (00:00 to 23:59 user-local) AND status ≠ done. Sorted by `dueAt` ascending. Calendar events come in Phase 3 — for now, only tasks. If empty: "Nothing due today — enjoy it."

### "Deadlines this week" section
Shows tasks where `dueAt` is within the next 7 days (rolling, including today) AND status ≠ done. Sorted by `dueAt` ascending. Each row shows: title, "in Xd Yh" countdown, color-coded urgency stripe (green > 5d, amber 2–5d, red < 2d). Click → tasks page with that task open. If empty: "Nothing on the horizon. Looking peaceful 🍃" (single emoji, opt-in).

### Reminder banners
Stacked at the top of the dashboard above all section cards, behavior per §4.

---

## 8. Countdown rendering

- For `dueAt` more than 24 hours away: render statically as "in 3d" or "in 5d 4h". Refresh on page load only.
- For `dueAt` within 24 hours: render with a `useEffect` interval that updates every 60 seconds.
- For `dueAt` within 1 hour: update every 10 seconds.
- For overdue tasks: "overdue 2d" / "overdue 5h", red text, no live update beyond every-minute.
- Use a single `<Countdown />` client component with `dueAt` as prop and a `precision` mode that auto-selects based on distance.

---

## 9. Server actions (sketch)

In `app/(app)/tasks/actions.ts`:

- `createTask(input: CreateTaskInput)` → validate Zod → insert task → if `dueAt`, generate 4 reminders → revalidate `/tasks` and `/dashboard`.
- `updateTask(id, patch)` → validate → update → if `dueAt` changed, recompute reminders (upsert by level) → if `title` changed, clear `tinyFirstStep` → revalidate.
- `setTaskStatus(id, status)` → update status (+ `completedAt` if done) → if moving out of `todo`, clear `tinyFirstStep` → if completing, delete pending reminders → revalidate.
- `deleteTask(id)` → cascade-delete reminders (Prisma `onDelete: Cascade` or manual) → delete task → revalidate.
- `dismissReminder(id)` → set `sentAt = now()` → revalidate path.
- `populateTinyFirstSteps(taskIds)` → lazy bulk evaluator called from the dashboard/tasks page loaders.

Authorize every action by checking `session.user.email === ALLOWED_EMAIL` and that the task's `userId` matches the session user's id. Don't trust client.

---

## 10. Acceptance criteria

Phase 2 is "done" when:

- [ ] `/tasks` page renders kanban-lite on desktop, list-with-filters on mobile (375px clean).
- [ ] User can create, edit, complete, uncomplete, and delete tasks via UI only.
- [ ] Drag-and-drop on desktop changes status persistently.
- [ ] Tasks with `dueAt` show color-coded countdowns matching the spec.
- [ ] Creating/updating a task with a `dueAt` upserts 4 reminder rows (visible in Prisma Studio).
- [ ] Reminder banners appear on dashboard when `fireAt <= now()` and disappear on dismiss.
- [ ] Completing a task within 6 hours of its deadline shows the "early ✓" annotation; later completion doesn't.
- [ ] Stalled todo tasks (3+ days untouched, dueAt within 14d) get a tiny-first-step suggestion that's stable across reloads.
- [ ] Dashboard "Today" and "Deadlines this week" sections show real task data with the right empty states.
- [ ] All UI copy matches the friendly-casual tone from the master brief.
- [ ] `npx tsc --noEmit` and `npx next build` pass clean.
- [ ] Manual test: create a task due in 6 days, due in 1 day, due in 30 minutes, overdue — verify each renders correctly and reminders fire.

---

## 11. Don't deviate without asking

If during build you want to:
- Add a paid dependency (anything beyond `@dnd-kit/core`, `zod`, `react-hook-form`, `date-fns`).
- Change the schema beyond the `@updatedAt` tweak in §3.
- Switch from Server Actions to API routes for any reason.
- Skip mobile responsiveness on any screen.
- Use streaks, points, or pomodoro UX anywhere (the user explicitly doesn't want them).

…stop and ask the user first.

Match the friendly-casual tone in every string. After implementation, demo on `/dashboard` and `/tasks` and ask the user to verify before declaring Phase 2 done.

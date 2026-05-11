# Deploying assist to production

This is the runbook for taking assist from local SQLite to Neon Postgres + Vercel. The bulk of the steps are on your end — Neon signup, Vercel project import, Google OAuth client edit. The repo already has the Postgres-ready schema, the build command, and the wiring in place.

If anything fails mid-way, you can always `git revert` the deploy-prep commit and stay local-only — see "Rolling back" at the bottom.

## 0. Pre-flight

Recommended one-time chores before you start:

- **Move the project out of OneDrive.** OneDrive sync is what causes the recurring `EPERM` errors on the Prisma engine binary during local migrations. Moving to a path like `C:\dev\assist` makes those go away. Not strictly required for deploy itself, but the dev experience post-deploy will be smoother.
- **Push to GitHub.** Vercel imports from a Git remote. Private repo is fine.

## 1. Stand up Neon (Postgres)

1. Sign up at https://neon.tech using GitHub auth.
2. Create a project — pick a region close to your Vercel deployment region (Frankfurt or Amsterdam for an Amsterdam-based user).
3. Note two URLs from the Neon dashboard:
   - **Pooled URL** — used as `DATABASE_URL`. The connection-pooler-fronted one (looks like `…-pooler.region.aws.neon.tech`).
   - **Direct URL** — used as `DIRECT_URL`. The non-pooled one. Prisma migrations need this.

Both will be visible in the connection-string panel; Neon labels them clearly.

## 2. Swap the local schema to Postgres

This breaks local SQLite dev permanently. Do it only once you're committed to deploying. (See "Rolling back" if you change your mind.)

From the project root:

```bash
# Replace the live schema with the Postgres-ready one
cp prisma/schema.postgres.prisma prisma/schema.prisma

# Discard the SQLite migration history and local DB
rm -rf prisma/migrations
rm -f  prisma/dev.db
```

Add the Neon URLs to your local `.env`:

```env
DATABASE_URL="<Neon pooled URL>"
DIRECT_URL="<Neon direct URL>"
```

Then generate a fresh Postgres migration history against Neon:

```bash
npx prisma migrate dev --name init_postgres
```

This connects to Neon (using `DIRECT_URL`), creates the schema, and writes a single `init_postgres` migration under `prisma/migrations/`. Commit the regenerated `prisma/migrations/` directory.

## 3. Set up the GitHub repo (if not already)

```bash
# Skip if you already have a remote
gh repo create assist --private --source . --push
```

## 4. Import to Vercel

1. https://vercel.com/new → import the GitHub repo.
2. Framework preset auto-detects as Next.js. Leave it.
3. **Set the build command to** `npm run build:vercel`. This expands to `prisma generate && prisma migrate deploy && next build` — migrations run against Neon at build time.
4. Add environment variables (Vercel dashboard → project → Settings → Environment Variables). Set each for **Production** (and Preview if you want preview deploys to work):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled URL |
   | `DIRECT_URL` | Neon direct URL |
   | `NEXTAUTH_SECRET` | Generate fresh: `openssl rand -base64 32`. Do **not** reuse your dev secret. |
   | `NEXTAUTH_URL` | `https://<your-project>.vercel.app` (or your custom domain) |
   | `GOOGLE_CLIENT_ID` | from Google Cloud Console — same client as dev is fine |
   | `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
   | `ALLOWED_EMAIL` | your email (the single-user gate) |
   | `ANTHROPIC_API_KEY` | optional — if unset, AI features fall back to templates |
   | `DEFAULT_CURRENCY` | `EUR` |
   | `DEFAULT_TIMEZONE` | `Europe/Amsterdam` |
   | `CALENDAR_SYNC_STALENESS_MINUTES` | `15` |
   | `CRON_SECRET` | Generate fresh: `openssl rand -base64 32`. Vercel auto-injects this as `Authorization: Bearer <secret>` on scheduled cron fires. Required for v2 email delivery and v3 daily price refresh. |
   | `TWELVE_DATA_API_KEY` | Optional — Twelve Data quote API key for v3 live investment prices. Leave blank to disable (holdings stay manual). Free tier: 8 req/min, 800/day. |
   | `ENABLE_BANKING_APPLICATION_ID` | Optional — Enable Banking application UUID for v4 banking. Get both from https://enablebanking.com → Control Panel → Applications. Leave blank to hide the Banking section. |
   | `ENABLE_BANKING_PRIVATE_KEY_BASE64` | Optional — RSA private key, **base64-encoded**, that Enable Banking pairs with your application. Required if the id is set. Generate the encoded form with `base64 -i private.pem` (macOS) or `base64 -w 0 < private.pem` (Linux). |

5. Deploy. The build runs `prisma migrate deploy` against Neon, then builds Next.

## 5. Update the Google OAuth client

Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID:

1. Add `https://<your-project>.vercel.app/api/auth/callback/google` to **Authorized redirect URIs**.
2. Add `https://<your-project>.vercel.app` to **Authorized JavaScript origins**.
3. Confirm the OAuth consent screen has the v2 scopes enabled: Calendar (readonly), Gmail (readonly), **Gmail (send)**. The send scope is new in v2 and is needed for daily briefing / weekly review email delivery.
4. Save.

If you skip the redirect URI step, sign-in fails with `redirect_uri_mismatch`. If you skip the send scope, the first time the cron tries to email you it will trip `ReauthRequiredError` and surface the reauth banner — at which point sign in again to grant the new scope.

## 6. Smoke test on production

Visit the production URL and run through:

- [ ] Sign in with Google → land on dashboard.
- [ ] Calendar sync indicator shows briefly, refresh pulls events.
- [ ] Add a task with a near deadline → reminder banner appears.
- [ ] Log a transaction, a budget, a bill → money card updates.
- [ ] Log an exercise session and a sleep entry → health card updates.
- [ ] Visit `/briefing` → today's briefing renders (AI prose if key set, template otherwise).
- [ ] Visit `/review` → most-recent week renders. Pick 3 priorities → they bump to high.
- [ ] If AI is enabled: `/settings` AI usage counter shows non-zero after the briefing call.
- [ ] Open on phone at the production URL. Verify the bottom tab bar works.
- [ ] Toggle dark mode (top nav) and verify every route still looks clean.

## 6b. Verify Vercel Cron registered (v2 + v3 + v4)

`vercel.json` declares four cron entries: `/api/cron/briefing` (hourly), `/api/cron/review` (hourly), `/api/cron/prices` (daily 05:00 UTC), and `/api/cron/banking` (daily 03:00 UTC). After the first deploy:

1. Vercel dashboard → your project → **Cron Jobs** tab. All four should be listed.
2. Click "Run now" on each and confirm a 200 response. `/api/cron/prices` and `/api/cron/banking` return `{"error":"... not set"}` with status 503 when the relevant env var is blank — that's expected and harmless.
3. In `/settings` → Email & notifications, enable the daily briefing toggle, set delivery hour to the next round hour, save, and wait for the cron to fire. Email lands in the user's own Gmail.
4. If you set `TWELVE_DATA_API_KEY`: on `/money` → Net Worth, the "Refresh prices" button appears next to "Add account". Click it once to verify connectivity; the daily cron handles ongoing refresh.
5. If you set the `ENABLE_BANKING_*` pair: a "Banking" section appears in `/settings`. Connect a bank → you'll be redirected to Enable Banking → your bank → back to `/settings?banking=connected`. Hit "Sync" to pull initial 90 days; the cron takes over after that.

## 6c. Banking callback URL (only if v4 is enabled)

The Enable Banking redirect URL must be **whitelisted in your Enable Banking application settings** — go to Control Panel → Applications → your app → Redirect URLs and add both:

- `http://localhost:3000/api/banking/callback` (dev)
- `https://<your-project>.vercel.app/api/banking/callback` (prod, or your custom domain)

Without that whitelist, the bank auth flow returns "invalid redirect_url" before the user even sees the consent screen. The callback URL is built from `NEXTAUTH_URL`, so make sure that env var matches your production URL exactly (no trailing slash, scheme + host only).

If a cron returns 401, the `CRON_SECRET` env var isn't set in Vercel — set it (and redeploy if needed).

## 7. (Optional) Custom domain

If you have a domain:

1. Vercel project → Settings → Domains → add it.
2. Follow the DNS instructions Vercel gives you.
3. Update `NEXTAUTH_URL` to the custom domain.
4. Add the new domain to Google's Authorized redirect URIs and origins.
5. Redeploy.

## 8. Tag v1.0.0

```bash
git tag -a v1.0.0 -m "v1.0 shipped"
git push origin v1.0.0
```

---

## Rolling back

If you flipped the schema but haven't deployed yet and want one more local round:

```bash
git revert <commit-hash-of-the-deploy-prep-commit>
rm -rf prisma/migrations
git checkout prisma/migrations  # restore the SQLite migration history
```

Then `npx prisma migrate dev` will recreate the SQLite `dev.db` from the restored history.

## Known limitations

- The migration is a clean break: your local SQLite data is sandbox-only and does not move to Neon. Production starts empty. This is intentional (and documented in the brief).
- `ExercisePlan.days` and `WeeklyReview.topPriorities` are stored as JSON-encoded strings rather than native Postgres `Json` columns. Code reads them via `JSON.parse`. A future cleanup migration can switch to native `Json` and gain index-ability; the v1 schema favors code parity with the SQLite dev path.
- AI cost estimates are derived from token counts × a per-model rate table, not pulled from Anthropic's billing API. They drift over time; treat the cap counter as a guide, not invoicing.

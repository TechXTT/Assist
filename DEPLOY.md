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

5. Deploy. The build runs `prisma migrate deploy` against Neon, then builds Next.

## 5. Update the Google OAuth client

Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID:

1. Add `https://<your-project>.vercel.app/api/auth/callback/google` to **Authorized redirect URIs**.
2. Add `https://<your-project>.vercel.app` to **Authorized JavaScript origins**.
3. Save.

If you skip this, the sign-in flow on production will fail with `redirect_uri_mismatch`.

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

# assist

A friendly, single-user personal-life dashboard (schedule, tasks, money, health, daily briefing, weekly review). Built per `personal-assistant-master-brief.md`.

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

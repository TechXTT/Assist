import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReauthBanner } from "@/app/(app)/dashboard/_components/reauth-banner";
import { GoogleConnectionCard } from "@/app/(app)/settings/_components/google-connection-card";
import { ConnectGoogleCard } from "@/app/(app)/settings/_components/connect-google-card";
import { syncCalendar } from "@/lib/google/sync";
import {
  NotConnectedError,
  ReauthRequiredError
} from "@/lib/google/errors";
import { aiSpendThisMonth, isAiAvailable } from "@/lib/ai/client";
import { AiUsageCard } from "@/app/(app)/settings/_components/ai-usage-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [user, googleAccount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        timezone: true,
        lastCalendarSyncAt: true,
        googleNeedsReauth: true
      }
    }),
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: "google" },
      select: { id: true }
    })
  ]);

  if (!user) redirect("/login");

  const connected = googleAccount !== null;

  // First connection / fresh DB: pull the calendar list eagerly so the
  // settings page can render the toggles on the very first visit.
  if (connected && !user.googleNeedsReauth && user.lastCalendarSyncAt === null) {
    try {
      await syncCalendar(session.user.id);
    } catch (err) {
      if (
        !(err instanceof ReauthRequiredError) &&
        !(err instanceof NotConnectedError)
      ) {
        console.error("[settings] initial sync failed:", err);
      }
    }
  }

  const [calendars, aiSpend] = await Promise.all([
    connected
      ? prisma.calendar.findMany({
          where: { userId: session.user.id },
          orderBy: [{ primary: "desc" }, { summary: "asc" }],
          select: {
            id: true,
            summary: true,
            backgroundColor: true,
            primary: true,
            syncEnabled: true,
            accessRole: true
          }
        })
      : Promise.resolve([]),
    aiSpendThisMonth(session.user.id, user.timezone || env.DEFAULT_TIMEZONE)
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Connections and preferences.</p>
      </div>

      {user.googleNeedsReauth && connected && <ReauthBanner />}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Connections</h2>
        {connected ? (
          <GoogleConnectionCard
            email={user.email}
            lastCalendarSyncAt={user.lastCalendarSyncAt}
            calendars={calendars}
          />
        ) : (
          <ConnectGoogleCard />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">AI</h2>
        <AiUsageCard
          spendCents={aiSpend.spendCents}
          capCents={aiSpend.capCents}
          currency={env.DEFAULT_CURRENCY}
          aiAvailable={isAiAvailable()}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Preferences</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Defaults</CardTitle>
            <CardDescription>
              Editable preferences land alongside later phases — for now these read from env.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="font-medium">{user.timezone || env.DEFAULT_TIMEZONE}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-medium">{env.DEFAULT_CURRENCY}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

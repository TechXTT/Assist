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
import { NotificationsCard } from "@/app/(app)/settings/_components/notifications-card";
import {
  BankConnectionsCard,
  type BankConnectionRow
} from "@/app/(app)/settings/_components/bank-connections-card";
import { isBankingAvailable } from "@/lib/banking/enablebanking";

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
        googleNeedsReauth: true,
        emailBriefingEnabled: true,
        emailReviewEnabled: true,
        emailDeliveryHour: true,
        emailReviewWeekday: true
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

  const bankingEnabled = isBankingAvailable();

  const [calendars, aiSpend, bankConnections] = await Promise.all([
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
    aiSpendThisMonth(session.user.id, user.timezone || env.DEFAULT_TIMEZONE),
    bankingEnabled
      ? prisma.bankConnection.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([])
  ]);

  const bankConnectionRows: BankConnectionRow[] = bankConnections.map((c) => {
    let accountCount = 0;
    try {
      const parsed = c.accountsJson ? (JSON.parse(c.accountsJson) as string[]) : [];
      if (Array.isArray(parsed)) accountCount = parsed.length;
    } catch {
      /* ignore */
    }
    return {
      id: c.id,
      institutionId: c.institutionId,
      institutionName: c.institutionName,
      status: c.status,
      lastSyncedAt: c.lastSyncedAt,
      expiresAt: c.expiresAt,
      accountCount
    };
  });

  // Infer a default country code from the user's timezone for the connect
  // dialog. Falls back to NL for the single-user app default.
  const tzCountry: Record<string, string> = {
    Amsterdam: "NL",
    London: "GB",
    Berlin: "DE",
    Paris: "FR",
    Madrid: "ES",
    Rome: "IT",
    Brussels: "BE",
    Vienna: "AT",
    Lisbon: "PT",
    Dublin: "IE",
    Helsinki: "FI",
    Stockholm: "SE",
    Oslo: "NO",
    Copenhagen: "DK",
    Warsaw: "PL"
  };
  const tzCity = (user.timezone || env.DEFAULT_TIMEZONE).split("/")[1] ?? "Amsterdam";
  const defaultCountry = tzCountry[tzCity] ?? "NL";

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

      {connected && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Email & notifications</h2>
          <NotificationsCard
            initial={{
              emailBriefingEnabled: user.emailBriefingEnabled,
              emailReviewEnabled: user.emailReviewEnabled,
              emailDeliveryHour: user.emailDeliveryHour,
              emailReviewWeekday: user.emailReviewWeekday
            }}
            email={user.email}
          />
        </section>
      )}

      {bankingEnabled && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Banking</h2>
          <BankConnectionsCard
            connections={bankConnectionRows}
            defaultCountry={defaultCountry}
          />
        </section>
      )}

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

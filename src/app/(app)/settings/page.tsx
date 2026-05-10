import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { PlaceholderCard } from "@/components/placeholder-card";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      <PlaceholderCard
        title="Settings"
        description="Connections, timezone, briefing time, and currency preferences will live here. Full UI lands alongside later phases."
      >
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="font-medium">{session?.user?.email}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Default timezone</dt>
            <dd className="font-medium">{env.DEFAULT_TIMEZONE}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Default currency</dt>
            <dd className="font-medium">{env.DEFAULT_CURRENCY}</dd>
          </div>
        </dl>
      </PlaceholderCard>
    </div>
  );
}

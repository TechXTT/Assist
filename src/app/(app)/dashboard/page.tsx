import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { PlaceholderCard } from "@/components/placeholder-card";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hey {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Your dashboard lives here. The real cards land in later phases — for now, this is the
          shell you'll come home to.
        </p>
      </div>

      <div className="grid gap-4">
        <PlaceholderCard
          title="Today"
          description="Your calendar and tasks for today will appear here once Google Calendar is connected (Phase 3) and you've added a few tasks (Phase 2)."
        />
        <PlaceholderCard
          title="Deadlines this week"
          description="Visible countdowns, color-coded by urgency. Coming with the deadline pressure engine in Phase 2."
        />
        <PlaceholderCard
          title="Money this month"
          description="Spending vs. budget, top categories, upcoming bills. Lands in Phase 4."
        />
        <PlaceholderCard
          title="Health this week"
          description="Sleep average, exercise minutes, and a mood mini-trendline. Lands in Phase 5."
        />
      </div>
    </div>
  );
}

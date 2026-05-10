import type { ReactNode } from "react";
import type { Session } from "next-auth";

import { TopNav } from "@/components/top-nav";
import { BottomTabs } from "@/components/bottom-tabs";

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav session={session} />
      <main className="container flex-1 py-6 pb-24 md:pb-10">{children}</main>
      <BottomTabs />
    </div>
  );
}

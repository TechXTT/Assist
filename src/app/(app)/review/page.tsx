import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildReviewPayload } from "@/lib/review/payload";
import {
  getOrCreateReview,
  listReviewHistory
} from "@/lib/review/get-or-create";
import { aiReviewRenderer } from "@/lib/review/render-via-ai";
import {
  reviewWeekForVisit,
  weekByIso,
  weekStartIso,
  type Week
} from "@/lib/review/week";

import { ReviewView } from "@/app/(app)/review/_components/review-view";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams
}: {
  searchParams: { week?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const currency = env.DEFAULT_CURRENCY;
  const now = new Date();

  const latestWeek = reviewWeekForVisit(tz, now);
  const selectedWeek: Week =
    (searchParams.week && weekByIso(tz, searchParams.week)) || latestWeek;

  const isLatest = selectedWeek.key.getTime() === latestWeek.key.getTime();

  const review = isLatest
    ? await getOrCreateReview(userId, selectedWeek, tz, currency, {
        aiRenderer: aiReviewRenderer
      })
    : (async () => {
        const existing = await prisma.weeklyReview.findUnique({
          where: {
            userId_forWeekStart: { userId, forWeekStart: selectedWeek.key }
          },
          select: {
            body: true,
            generatedBy: true,
            modelUsed: true,
            generatedAt: true,
            topPriorities: true
          }
        });
        if (existing) {
          let parsed: string[] = [];
          try {
            const v = existing.topPriorities ? JSON.parse(existing.topPriorities) : [];
            if (Array.isArray(v)) parsed = v.filter((s) => typeof s === "string");
          } catch {
            /* ignore */
          }
          return { ...existing, topPriorities: parsed };
        }
        // No cached row for past weeks — render template fresh, don't persist.
        const payload = await buildReviewPayload(userId, selectedWeek, tz, currency, now);
        const { renderReviewTemplate } = await import("@/lib/review/render-template");
        return {
          body: renderReviewTemplate(payload),
          generatedBy: "template",
          modelUsed: null,
          generatedAt: new Date(),
          topPriorities: [] as string[]
        };
      })();

  const [resolvedReview, history, openTodos] = await Promise.all([
    Promise.resolve(review),
    listReviewHistory(userId, 12),
    prisma.task.findMany({
      where: { userId, status: "todo" },
      orderBy: [{ dueAt: "asc" }],
      take: 20,
      select: { id: true, title: true, dueAt: true, priority: true }
    })
  ]);

  const weekIso = weekStartIso(tz, selectedWeek);
  const weekLabel = `${selectedWeek.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })} → ${selectedWeek.end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Weekly review</h1>
        <p className="text-sm text-muted-foreground">
          Look back, then pick the next three priorities.
        </p>
      </div>

      <ReviewView
        body={resolvedReview.body}
        generatedBy={resolvedReview.generatedBy}
        modelUsed={resolvedReview.modelUsed}
        generatedAt={resolvedReview.generatedAt}
        weekLabel={weekLabel}
        weekIso={weekIso}
        isLatest={isLatest}
        currentPicks={resolvedReview.topPriorities}
        openTodos={openTodos}
        history={history.map((h) => ({
          weekIso: weekStartIso(tz, { start: h.forWeekStart, end: h.forWeekStart, key: h.forWeekStart }),
          label: h.forWeekStart.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
          generatedBy: h.generatedBy
        }))}
      />
    </div>
  );
}

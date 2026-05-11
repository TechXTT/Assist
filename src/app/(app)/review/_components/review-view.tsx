"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  regenerateReviewLatest,
  saveTopPriorities
} from "@/app/(app)/review/actions";

type HistoryEntry = { weekIso: string; label: string; generatedBy: string };
type OpenTodo = { id: string; title: string; dueAt: Date | null; priority: string };

export function ReviewView({
  body,
  generatedBy,
  modelUsed,
  generatedAt,
  weekLabel,
  weekIso,
  isLatest,
  currentPicks,
  openTodos,
  history
}: {
  body: string;
  generatedBy: string;
  modelUsed: string | null;
  generatedAt: Date;
  weekLabel: string;
  weekIso: string;
  isLatest: boolean;
  currentPicks: string[];
  openTodos: OpenTodo[];
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>(currentPicks);
  const [pending, startTransition] = useTransition();
  const [regening, setRegening] = useState(false);
  const [saving, setSaving] = useState(false);

  function switchWeek(value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "latest") next.delete("week");
    else next.set("week", value);
    const qs = next.toString();
    router.replace(`/review${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function toggleTask(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast.info("3 picks max — drop one first.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function savePicks() {
    setSaving(true);
    startTransition(async () => {
      try {
        await saveTopPriorities({ weekIso, taskIds: selected });
        toast.success("Priorities saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
      } finally {
        setSaving(false);
      }
    });
  }

  function regenerate() {
    setRegening(true);
    startTransition(async () => {
      try {
        await regenerateReviewLatest();
        toast.success("Review refreshed.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't regenerate.");
      } finally {
        setRegening(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={isLatest ? "latest" : weekIso} onValueChange={switchWeek}>
          <SelectTrigger className="h-9 w-[240px]">
            <SelectValue placeholder="Pick a week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest week</SelectItem>
            {history.map((h) => (
              <SelectItem key={h.weekIso} value={h.weekIso}>
                {h.label}
                {h.generatedBy === "ai" ? " · AI" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLatest && (
          <Button size="sm" variant="outline" onClick={regenerate} disabled={pending || regening}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
            {regening ? "Refreshing…" : "Regenerate"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{weekLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-stone max-w-prose space-y-3 text-sm leading-relaxed dark:prose-invert">
            {body.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {generatedBy === "ai"
              ? `Written by ${modelUsed ?? "Haiku"}`
              : "Template"}{" "}
            · generated {format(generatedAt, "d MMM, HH:mm")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 3 priorities for next week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLatest ? (
            <>
              {openTodos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open todos to pick from. Add tasks on /tasks first.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {openTodos.map((t) => {
                    const checked = selected.includes(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => toggleTask(t.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            checked
                              ? "border-foreground bg-foreground/5"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <CheckCircle2
                            className={cn(
                              "h-4 w-4 shrink-0",
                              checked ? "text-foreground" : "text-muted-foreground/40"
                            )}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{t.title}</span>
                          {t.dueAt && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              due {format(t.dueAt, "d MMM")}
                            </span>
                          )}
                          {t.priority === "high" && (
                            <span className="shrink-0 text-xs text-amber-700 dark:text-amber-400">
                              high
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {selected.length} of 3 selected. Picks will be tagged "high" priority.
                </p>
                <Button size="sm" onClick={savePicks} disabled={saving || pending}>
                  {saving ? "Saving…" : "Save picks"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-sm">
              {currentPicks.length === 0 ? (
                <p className="text-muted-foreground">No picks saved for this week.</p>
              ) : (
                <ul className="list-inside list-disc space-y-1">
                  {currentPicks.map((id) => {
                    const match = openTodos.find((t) => t.id === id);
                    return <li key={id}>{match?.title ?? id}</li>;
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Past weeks are read-only.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

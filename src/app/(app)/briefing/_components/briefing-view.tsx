"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
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
import { regenerateBriefingToday } from "@/app/(app)/briefing/actions";

type HistoryEntry = { dateIso: string; label: string; generatedBy: string };

export function BriefingView({
  body,
  generatedBy,
  modelUsed,
  generatedAt,
  isToday,
  forDateLabel,
  forDateIso,
  history
}: {
  body: string | null;
  generatedBy: string | null;
  modelUsed: string | null;
  generatedAt: Date | null;
  isToday: boolean;
  forDateLabel: string;
  forDateIso: string;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [regening, setRegening] = useState(false);

  function switchDate(value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "today") next.delete("date");
    else next.set("date", value);
    const qs = next.toString();
    router.replace(`/briefing${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function regenerate() {
    setRegening(true);
    startTransition(async () => {
      try {
        await regenerateBriefingToday();
        toast.success("Briefing refreshed.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't regenerate.");
      } finally {
        setRegening(false);
      }
    });
  }

  const hasHistory = history.length > 0;
  const selectValue = isToday ? "today" : forDateIso;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectValue} onValueChange={switchDate}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder="Pick a date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            {hasHistory && (
              <>
                {history.map((h) => (
                  <SelectItem key={h.dateIso} value={h.dateIso}>
                    {h.label}
                    {h.generatedBy === "ai" ? " · AI" : ""}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        {isToday && (
          <Button
            size="sm"
            variant="outline"
            onClick={regenerate}
            disabled={pending || regening}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
            {regening ? "Refreshing…" : "Regenerate"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{forDateLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {body ? (
            <div className="prose prose-stone max-w-prose space-y-3 text-sm leading-relaxed dark:prose-invert">
              {body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No briefing for that day yet.
            </p>
          )}
          {generatedBy && generatedAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              {generatedBy === "ai"
                ? `Written by ${modelUsed ?? "Haiku"}`
                : "Template"}{" "}
              · generated {new Date(generatedAt).toLocaleString("en-GB", { hour12: false })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

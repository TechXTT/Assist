"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  setEmailPrefs,
  sendTestEmailAction
} from "@/app/(app)/settings/actions";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function NotificationsCard({
  initial,
  email
}: {
  initial: {
    emailBriefingEnabled: boolean;
    emailReviewEnabled: boolean;
    emailDeliveryHour: number;
    emailReviewWeekday: number;
  };
  email: string;
}) {
  const [briefing, setBriefing] = useState(initial.emailBriefingEnabled);
  const [review, setReview] = useState(initial.emailReviewEnabled);
  const [hour, setHour] = useState(initial.emailDeliveryHour);
  const [weekday, setWeekday] = useState(initial.emailReviewWeekday);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  const dirty =
    briefing !== initial.emailBriefingEnabled ||
    review !== initial.emailReviewEnabled ||
    hour !== initial.emailDeliveryHour ||
    weekday !== initial.emailReviewWeekday;

  function save() {
    startSave(async () => {
      try {
        await setEmailPrefs({
          emailBriefingEnabled: briefing,
          emailReviewEnabled: review,
          emailDeliveryHour: hour,
          emailReviewWeekday: weekday
        });
        toast.success("Saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function sendTest() {
    startSend(async () => {
      const result = await sendTestEmailAction();
      if (result.ok) {
        toast.success(`Test email sent to ${email}.`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
          Email & notifications
        </CardTitle>
        <CardDescription>
          Sent from your own Gmail to <span className="font-medium">{email}</span>. Vercel Cron
          fires the daily/weekly check hourly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Daily briefing email</p>
            <p className="text-xs text-muted-foreground">
              Same body as the /briefing page, delivered at your chosen hour.
            </p>
          </div>
          <Switch checked={briefing} onCheckedChange={setBriefing} aria-label="Daily briefing email" />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Weekly review email</p>
            <p className="text-xs text-muted-foreground">
              Sent once a week on the day and hour you pick.
            </p>
          </div>
          <Switch checked={review} onCheckedChange={setReview} aria-label="Weekly review email" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="email-hour" className="text-xs text-muted-foreground">
              Delivery hour (your timezone)
            </label>
            <Input
              id="email-hour"
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setHour(Math.max(0, Math.min(23, n)));
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email-weekday" className="text-xs text-muted-foreground">
              Weekly review day
            </label>
            <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
              <SelectTrigger id="email-weekday" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_LABELS.map((label, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={sendTest}
            disabled={sending}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send test email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

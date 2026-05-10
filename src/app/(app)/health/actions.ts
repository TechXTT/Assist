"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { startOfDay } from "date-fns";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { deriveHoursFromTimes, localDateOnly } from "@/lib/health/sleep";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

async function userTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  return u?.timezone || env.DEFAULT_TIMEZONE;
}

async function requireOwnedSession(id: string, userId: string) {
  const s = await prisma.exerciseSession.findUnique({
    where: { id },
    select: { id: true, userId: true }
  });
  if (!s || s.userId !== userId) throw new Error("Session not found.");
  return s;
}

function revalidate() {
  revalidatePath("/health");
  revalidatePath("/dashboard");
}

function parseDateOnly(input: string, tz: string): Date {
  // Accept "YYYY-MM-DD" or full ISO. Map to user local midnight, then to UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return fromZonedTime(`${input}T00:00:00`, tz);
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date.");
  const local = toZonedTime(d, tz);
  return fromZonedTime(startOfDay(local), tz);
}

// ----- Exercise -----

const createSessionSchema = z.object({
  activity: z.string().trim().min(1, "What did you do?").max(60),
  minutes: z.number().int().positive("Minutes above zero.").max(24 * 60),
  occurredAt: z.string().min(1, "Pick a date."),
  notes: z.string().trim().max(500).optional().nullable()
});

const updateSessionSchema = createSessionSchema.partial();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export async function createSession(input: CreateSessionInput) {
  const session = await requireSession();
  const data = createSessionSchema.parse(input);
  const tz = await userTimezone(session.user.id);

  const created = await prisma.exerciseSession.create({
    data: {
      userId: session.user.id,
      activity: data.activity,
      minutes: data.minutes,
      occurredAt: parseDateOnly(data.occurredAt, tz),
      notes: data.notes?.trim() || null
    }
  });
  revalidate();
  return { id: created.id };
}

export async function updateSession(id: string, input: UpdateSessionInput) {
  const session = await requireSession();
  const data = updateSessionSchema.parse(input);
  await requireOwnedSession(id, session.user.id);
  const tz = await userTimezone(session.user.id);

  await prisma.exerciseSession.update({
    where: { id },
    data: {
      ...(typeof data.activity === "string" && { activity: data.activity }),
      ...(typeof data.minutes === "number" && { minutes: data.minutes }),
      ...(typeof data.occurredAt === "string" && {
        occurredAt: parseDateOnly(data.occurredAt, tz)
      }),
      ...(typeof data.notes !== "undefined" && { notes: data.notes?.trim() || null })
    }
  });
  revalidate();
}

export async function deleteSession(id: string) {
  const session = await requireSession();
  await requireOwnedSession(id, session.user.id);
  await prisma.exerciseSession.delete({ where: { id } });
  revalidate();
}

const setWeeklyTargetSchema = z.object({
  minutes: z.number().int().min(0).max(24 * 60 * 7)
});

export async function setWeeklyTarget(input: z.infer<typeof setWeeklyTargetSchema>) {
  const session = await requireSession();
  const data = setWeeklyTargetSchema.parse(input);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { weeklyExerciseTargetMinutes: data.minutes }
  });
  revalidate();
}

// ----- Sleep -----

const logSleepHoursSchema = z.object({
  mode: z.literal("hours"),
  date: z.string().min(1, "Pick a date."),
  hours: z.number().positive("Hours above zero.").max(24)
});

const logSleepTimesSchema = z.object({
  mode: z.literal("times"),
  date: z.string().min(1, "Pick a date."),
  bedtime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm."),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm.")
});

const logSleepSchema = z.discriminatedUnion("mode", [
  logSleepHoursSchema,
  logSleepTimesSchema
]);

export type LogSleepInput = z.infer<typeof logSleepSchema>;

export async function logSleep(input: LogSleepInput) {
  const session = await requireSession();
  const data = logSleepSchema.parse(input);
  const tz = await userTimezone(session.user.id);

  const hours =
    data.mode === "hours"
      ? data.hours
      : deriveHoursFromTimes(data.bedtime, data.wakeTime);

  if (hours <= 0 || hours > 24) throw new Error("Hours out of range.");

  const dateUtc = parseDateOnly(data.date, tz);

  await prisma.habitLog.upsert({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    update: { sleepHours: hours },
    create: { userId: session.user.id, date: dateUtc, sleepHours: hours }
  });
  revalidate();
}

const setSleepTargetSchema = z.object({
  hours: z.number().positive().max(24).nullable()
});

export async function setSleepTarget(input: z.infer<typeof setSleepTargetSchema>) {
  const session = await requireSession();
  const data = setSleepTargetSchema.parse(input);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { sleepTargetHours: data.hours }
  });
  revalidate();
}

const setWindDownPrefsSchema = z
  .object({
    enabled: z.boolean(),
    targetBedtime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm.").nullable(),
    minutesBefore: z.number().int().min(5).max(180)
  })
  .refine(
    (v) => (v.enabled ? v.targetBedtime !== null : true),
    { message: "Set a target bedtime to enable wind-down." }
  );

export async function setWindDownPrefs(input: z.infer<typeof setWindDownPrefsSchema>) {
  const session = await requireSession();
  const data = setWindDownPrefsSchema.parse(input);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      windDownEnabled: data.enabled,
      targetBedtime: data.targetBedtime,
      windDownMinutesBefore: data.minutesBefore
    }
  });
  revalidate();
}

export async function dismissWindDown() {
  const session = await requireSession();
  const tz = await userTimezone(session.user.id);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastWindDownDismissedOn: localDateOnly(new Date(), tz) }
  });
  revalidatePath("/dashboard");
}

// ----- Nutrition -----

const bumpSchema = z.object({ delta: z.number().int() });

async function upsertTodayLog(userId: string, tz: string) {
  const dateUtc = localDateOnly(new Date(), tz);
  await prisma.habitLog.upsert({
    where: { userId_date: { userId, date: dateUtc } },
    update: {},
    create: { userId, date: dateUtc }
  });
  return dateUtc;
}

export async function bumpWater(input: z.infer<typeof bumpSchema>) {
  const session = await requireSession();
  const { delta } = bumpSchema.parse(input);
  const tz = await userTimezone(session.user.id);
  const dateUtc = await upsertTodayLog(session.user.id, tz);

  const row = await prisma.habitLog.findUnique({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    select: { waterGlasses: true }
  });
  const next = Math.max(0, (row?.waterGlasses ?? 0) + delta);
  await prisma.habitLog.update({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    data: { waterGlasses: next }
  });
  revalidate();
}

export async function bumpMeals(input: z.infer<typeof bumpSchema>) {
  const session = await requireSession();
  const { delta } = bumpSchema.parse(input);
  const tz = await userTimezone(session.user.id);
  const dateUtc = await upsertTodayLog(session.user.id, tz);

  const row = await prisma.habitLog.findUnique({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    select: { mealsLogged: true }
  });
  const next = Math.max(0, (row?.mealsLogged ?? 0) + delta);
  await prisma.habitLog.update({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    data: { mealsLogged: next }
  });
  revalidate();
}

const setDailyNoteSchema = z.object({
  date: z.string().min(1, "Pick a date."),
  text: z.string().max(500)
});

export async function setDailyNote(input: z.infer<typeof setDailyNoteSchema>) {
  const session = await requireSession();
  const data = setDailyNoteSchema.parse(input);
  const tz = await userTimezone(session.user.id);
  const dateUtc = parseDateOnly(data.date, tz);
  const trimmed = data.text.trim();

  await prisma.habitLog.upsert({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    update: { notes: trimmed || null },
    create: { userId: session.user.id, date: dateUtc, notes: trimmed || null }
  });
  revalidate();
}

// ----- Mood -----

const setMoodSchema = z.object({
  date: z.string().min(1, "Pick a date."),
  score: z.number().int().min(1).max(5).nullable()
});

export async function setMood(input: z.infer<typeof setMoodSchema>) {
  const session = await requireSession();
  const data = setMoodSchema.parse(input);
  const tz = await userTimezone(session.user.id);
  const dateUtc = parseDateOnly(data.date, tz);

  await prisma.habitLog.upsert({
    where: { userId_date: { userId: session.user.id, date: dateUtc } },
    update: { mood: data.score },
    create: { userId: session.user.id, date: dateUtc, mood: data.score }
  });
  revalidate();
}

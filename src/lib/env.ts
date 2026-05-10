import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ALLOWED_EMAIL: z.string().email(),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  AI_MONTHLY_CAP_USD: z.coerce.number().default(5),
  DEFAULT_TIMEZONE: z.string().default("Europe/Amsterdam"),
  DEFAULT_CURRENCY: z.string().default("EUR"),
  CALENDAR_SYNC_STALENESS_MINUTES: z.coerce.number().default(15)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — see logs above.");
}

export const env = parsed.data;
export const aiEnabled = env.ANTHROPIC_API_KEY.length > 0;

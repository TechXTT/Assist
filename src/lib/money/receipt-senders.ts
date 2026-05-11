/**
 * Heuristic Gmail search query for likely-receipt messages. Built as one OR'd
 * `from:` clause plus subject keywords. Tighter is better — false positives
 * waste AI tokens against the user's monthly cap.
 *
 * Out of v2 scope to make this user-editable in the UI; live changes go here.
 */

const FROM_DOMAINS = [
  // Generic receipt senders
  "receipts@",
  "receipt@",
  "billing@",
  "no-reply@stripe.com",
  "noreply@stripe.com",
  "no-reply@paypal.com",
  "service@paypal.com",
  // Streaming + SaaS
  "no-reply@spotify.com",
  "noreply@netflix.com",
  "billing@github.com",
  "noreply@notion.so",
  "billing@openai.com",
  "no-reply@anthropic.com",
  "billing@vercel.com",
  // Stores (NL/EU-leaning)
  "no-reply@bol.com",
  "no-reply@coolblue.nl",
  "noreply@ah.nl",
  // Travel
  "noreply@booking.com",
  "noreply@uber.com",
  "noreply@lyftmail.com"
];

const SUBJECT_KEYWORDS = [
  "receipt",
  "invoice",
  "your order",
  "order confirmation",
  "payment received",
  "payment confirmation",
  "thanks for your order",
  "thank you for your order",
  "thank you for your purchase",
  "subscription renewed",
  "factuur",
  "kwitantie"
];

export function buildReceiptQuery(opts: { days: number }): string {
  const fromClause = FROM_DOMAINS.map((d) => `from:${d}`).join(" OR ");
  const subjClause = SUBJECT_KEYWORDS.map((k) => `subject:"${k}"`).join(" OR ");
  return `(${fromClause} OR ${subjClause}) newer_than:${opts.days}d -in:spam -in:trash`;
}

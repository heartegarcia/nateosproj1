import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { DailyReview, UpdateDailyReviewInput } from "./types";

export function getReviewByDate(date: string): DailyReview | null {
  return (db.prepare("SELECT * FROM daily_reviews WHERE review_date = ?").get(date) as DailyReview | undefined) ?? null;
}

export function listReviewDates(): string[] {
  const rows = db.prepare("SELECT review_date FROM daily_reviews ORDER BY review_date DESC").all() as {
    review_date: string;
  }[];
  return rows.map((r) => r.review_date);
}

export function upsertReview(date: string, input: UpdateDailyReviewInput): DailyReview {
  const existing = getReviewByDate(date);
  const now = new Date().toISOString();

  if (existing) {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id: existing.id, now };
    for (const key of ["wins", "blockers", "tomorrow"] as const) {
      if (input[key] !== undefined) {
        fields.push(`${key} = @${key}`);
        params[key] = input[key];
      }
    }
    if (fields.length > 0) {
      db.prepare(`UPDATE daily_reviews SET ${fields.join(", ")}, updated_at = @now WHERE id = @id`).run(params);
    }
    return getReviewByDate(date)!;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO daily_reviews (id, review_date, wins, blockers, tomorrow, created_at, updated_at)
     VALUES (@id, @date, @wins, @blockers, @tomorrow, @now, @now)`
  ).run({
    id,
    date,
    wins: input.wins ?? null,
    blockers: input.blockers ?? null,
    tomorrow: input.tomorrow ?? null,
    now,
  });
  return getReviewByDate(date)!;
}

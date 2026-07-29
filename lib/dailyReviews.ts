import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { DailyReview, ReviewTaskSummary, UpdateDailyReviewInput } from "./types";

interface DailyReviewRow {
  id: string;
  review_date: string;
  wins: string | null;
  blockers: string | null;
  tomorrow: string | null;
  in_progress_summary: string | null;
  waiting_summary: string | null;
  overdue_summary: string | null;
  created_at: string;
  updated_at: string;
}

function parseSummary(json: string | null): ReviewTaskSummary[] | null {
  return json ? JSON.parse(json) : null;
}

function hydrate(row: DailyReviewRow): DailyReview {
  return {
    ...row,
    in_progress_summary: parseSummary(row.in_progress_summary),
    waiting_summary: parseSummary(row.waiting_summary),
    overdue_summary: parseSummary(row.overdue_summary),
  };
}

export async function getReviewByDate(date: string): Promise<DailyReview | null> {
  const row = await db.prepare("SELECT * FROM daily_reviews WHERE review_date = ?").get<DailyReviewRow>(date);
  return row ? hydrate(row) : null;
}

export async function listReviewDates(): Promise<string[]> {
  const rows = await db
    .prepare("SELECT review_date FROM daily_reviews ORDER BY review_date DESC")
    .all<{ review_date: string }>();
  return rows.map((r) => r.review_date);
}

export async function upsertReview(date: string, input: UpdateDailyReviewInput): Promise<DailyReview> {
  const existing = await getReviewByDate(date);
  const now = new Date().toISOString();

  const textFields: Record<string, unknown> = {
    wins: input.wins,
    blockers: input.blockers,
    tomorrow: input.tomorrow,
  };
  const jsonFields: Record<string, ReviewTaskSummary[] | undefined> = {
    in_progress_summary: input.inProgressSummary,
    waiting_summary: input.waitingSummary,
    overdue_summary: input.overdueSummary,
  };

  if (existing) {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id: existing.id, now };
    for (const [col, val] of Object.entries(textFields)) {
      if (val !== undefined) {
        fields.push(`${col} = @${col}`);
        params[col] = val;
      }
    }
    for (const [col, val] of Object.entries(jsonFields)) {
      if (val !== undefined) {
        fields.push(`${col} = @${col}`);
        params[col] = JSON.stringify(val);
      }
    }
    if (fields.length > 0) {
      await db
        .prepare(`UPDATE daily_reviews SET ${fields.join(", ")}, updated_at = @now WHERE id = @id`)
        .run(params);
    }
    return (await getReviewByDate(date))!;
  }

  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO daily_reviews
         (id, review_date, wins, blockers, tomorrow, in_progress_summary, waiting_summary, overdue_summary, created_at, updated_at)
       VALUES (@id, @date, @wins, @blockers, @tomorrow, @inProgressSummary, @waitingSummary, @overdueSummary, @now, @now)
       ON CONFLICT (review_date) DO NOTHING`
    )
    .run({
      id,
      date,
      wins: input.wins ?? null,
      blockers: input.blockers ?? null,
      tomorrow: input.tomorrow ?? null,
      inProgressSummary: input.inProgressSummary ? JSON.stringify(input.inProgressSummary) : null,
      waitingSummary: input.waitingSummary ? JSON.stringify(input.waitingSummary) : null,
      overdueSummary: input.overdueSummary ? JSON.stringify(input.overdueSummary) : null,
      now,
    });
  return (await getReviewByDate(date))!;
}

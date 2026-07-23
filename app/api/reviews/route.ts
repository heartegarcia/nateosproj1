import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getReviewByDate, upsertReview } from "@/lib/dailyReviews";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  return NextResponse.json({ review: getReviewByDate(date) });
}

const upsertSchema = z.object({
  date: z.string().min(1),
  wins: z.string().optional(),
  blockers: z.string().optional(),
  tomorrow: z.string().optional(),
});

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { date, ...rest } = parsed.data;
  const review = upsertReview(date, rest);
  return NextResponse.json({ review });
}

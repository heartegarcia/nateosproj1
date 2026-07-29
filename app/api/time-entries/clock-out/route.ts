import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { clockOut, getRunningEntry } from "@/lib/timeEntries";

const schema = z.object({ endTime: z.string().min(1) });

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const running = await getRunningEntry();
  if (!running) return NextResponse.json({ error: "Not currently clocked in." }, { status: 409 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const entry = await clockOut(running.id, parsed.data.endTime);
  return NextResponse.json({ entry });
}

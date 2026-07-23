import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createManualEntry, listEntries } from "@/lib/timeEntries";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const unbilledOnly = url.searchParams.get("unbilledOnly") === "true";

  return NextResponse.json({ entries: listEntries({ from, to, unbilledOnly }) });
}

const createSchema = z.object({
  workDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const entry = createManualEntry(parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}

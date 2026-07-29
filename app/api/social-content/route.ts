import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { listSlots, upsertSlot } from "@/lib/socialContent";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  return NextResponse.json({ slots: await listSlots(from, to) });
}

const createSchema = z.object({
  date: z.string().min(1),
  stage: z.enum(["concept", "final"]),
  title: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const slot = await upsertSlot(parsed.data);
  return NextResponse.json({ slot }, { status: 201 });
}

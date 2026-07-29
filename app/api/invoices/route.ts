import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { generateInvoice, listInvoices, NoUnbilledHoursError } from "@/lib/invoices";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ invoices: await listInvoices() });
}

const schema = z.object({
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const invoice = await generateInvoice(parsed.data.periodStart ?? null, parsed.data.periodEnd ?? null);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof NoUnbilledHoursError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

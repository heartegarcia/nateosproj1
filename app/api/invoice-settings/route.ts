import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getInvoiceSettings, updateInvoiceSettings } from "@/lib/invoiceSettings";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ settings: getInvoiceSettings() });
}

const schema = z.object({
  fullName: z.string().optional(),
  bankDetails: z.string().optional(),
  hourlyRate: z.number().nonnegative().optional(),
  paymentTerms: z.string().optional(),
});

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = updateInvoiceSettings(parsed.data);
  return NextResponse.json({ settings });
}

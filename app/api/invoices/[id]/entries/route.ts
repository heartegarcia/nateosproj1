import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listEntries } from "@/lib/timeEntries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ entries: await listEntries({ invoiceId: id }) });
}

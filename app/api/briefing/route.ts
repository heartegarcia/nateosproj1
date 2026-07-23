import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getExecutiveBriefing } from "@/lib/briefing";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const today = url.searchParams.get("today") ?? undefined;
  return NextResponse.json({ briefing: getExecutiveBriefing(today) });
}

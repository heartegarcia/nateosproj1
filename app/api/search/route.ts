import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { search } from "@/lib/search";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  return NextResponse.json({ results: await search(q) });
}

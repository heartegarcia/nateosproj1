import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createTaskFolder, listTaskFolders } from "@/lib/taskFolders";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ folders: listTaskFolders(id) });
}

const createSchema = z.object({ name: z.string().min(1) });

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  createTaskFolder(id, parsed.data.name);
  return NextResponse.json({ folders: listTaskFolders(id) }, { status: 201 });
}

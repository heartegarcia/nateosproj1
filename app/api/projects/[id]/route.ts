import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getProjectById, softDeleteProject, updateProject, updateProjectViewMode } from "@/lib/projects";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

const updateSchema = z.object({
  viewMode: z.enum(["gallery", "list"]).optional(),
  status: z.enum(["active", "on_hold", "completed"]).optional(),
  health: z.enum(["on_track", "at_risk", "behind"]).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if ((parsed.data.status || parsed.data.health) && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.viewMode) updateProjectViewMode(id, parsed.data.viewMode);
  if (parsed.data.status || parsed.data.health) {
    updateProject(id, { status: parsed.data.status, health: parsed.data.health });
  }
  const project = getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  softDeleteProject(id);
  return NextResponse.json({ ok: true });
}

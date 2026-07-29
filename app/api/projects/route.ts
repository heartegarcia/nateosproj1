import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createProject, listAllProjects, listChildProjects, listProjectsByBusiness } from "@/lib/projects";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId");
  const parentId = url.searchParams.get("parentId");

  const projects = parentId
    ? await listChildProjects(parentId)
    : businessId
      ? await listProjectsByBusiness(businessId)
      : await listAllProjects();
  return NextResponse.json({ projects });
}

const createSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  parentProjectId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await createProject(parsed.data);
  return NextResponse.json({ project }, { status: 201 });
}

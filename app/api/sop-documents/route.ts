import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createSopFileDocument, createSopLinkDocument, listSopDocuments } from "@/lib/sopDocuments";

const CATEGORIES = ["sop", "contract", "playbook", "training", "onboarding", "other"] as const;

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search")?.toLowerCase().trim();

  let documents = await listSopDocuments();
  if (category) documents = documents.filter((d) => d.category === category);
  if (search) documents = documents.filter((d) => d.title.toLowerCase().includes(search));

  return NextResponse.json({ documents });
}

const linkSchema = z.object({
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  externalUrl: z.string().url(),
  notes: z.string().nullable().optional(),
});

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const title = formData.get("title");
    const category = formData.get("category");
    const notes = formData.get("notes");
    const file = formData.get("file");

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (typeof category !== "string" || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds the 25MB limit" }, { status: 400 });
    }

    const document = await createSopFileDocument(
      title.trim(),
      category as (typeof CATEGORIES)[number],
      typeof notes === "string" && notes.trim() ? notes.trim() : null,
      file
    );
    return NextResponse.json({ document }, { status: 201 });
  }

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const document = await createSopLinkDocument(
    parsed.data.title,
    parsed.data.category,
    parsed.data.externalUrl,
    parsed.data.notes ?? null
  );
  return NextResponse.json({ document }, { status: 201 });
}

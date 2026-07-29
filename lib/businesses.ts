import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { Business, CreateBusinessInput } from "./types";

export async function listBusinesses(): Promise<Business[]> {
  return db.prepare("SELECT * FROM businesses ORDER BY sort_order ASC").all<Business>();
}

export async function getBusinessById(id: string): Promise<Business | null> {
  return (await db.prepare("SELECT * FROM businesses WHERE id = ?").get<Business>(id)) ?? null;
}

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const id = randomUUID();
  const maxSort = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as m FROM businesses")
    .get<{ m: number }>();
  await db
    .prepare(
      `INSERT INTO businesses (id, name, color, sort_order, created_at) VALUES (@id, @name, @color, @sortOrder, @createdAt)`
    )
    .run({ id, name: input.name, color: input.color, sortOrder: (maxSort?.m ?? -1) + 1, createdAt: new Date().toISOString() });
  return (await getBusinessById(id))!;
}

import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { Business, CreateBusinessInput } from "./types";

export function listBusinesses(): Business[] {
  return db.prepare("SELECT * FROM businesses ORDER BY sort_order ASC").all() as Business[];
}

export function getBusinessById(id: string): Business | null {
  return (db.prepare("SELECT * FROM businesses WHERE id = ?").get(id) as Business | undefined) ?? null;
}

export function createBusiness(input: CreateBusinessInput): Business {
  const id = randomUUID();
  const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), -1) as m FROM businesses").get() as { m: number };
  db.prepare(
    `INSERT INTO businesses (id, name, color, sort_order, created_at) VALUES (@id, @name, @color, @sortOrder, @createdAt)`
  ).run({ id, name: input.name, color: input.color, sortOrder: maxSort.m + 1, createdAt: new Date().toISOString() });
  return getBusinessById(id)!;
}

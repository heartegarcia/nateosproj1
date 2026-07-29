import { db } from "./db";
import type { User } from "./types";

export async function getUserByEmail(email: string): Promise<User | null> {
  return (await db.prepare("SELECT * FROM users WHERE email = ?").get<User>(email)) ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  return (await db.prepare("SELECT * FROM users WHERE id = ?").get<User>(id)) ?? null;
}

export async function getUserByRole(role: User["role"]): Promise<User | null> {
  return (
    (await db
      .prepare("SELECT * FROM users WHERE role = ? ORDER BY created_at ASC LIMIT 1")
      .get<User>(role)) ?? null
  );
}

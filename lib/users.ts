import { db } from "./db";
import type { User } from "./types";

export function getUserByEmail(email: string): User | null {
  return (db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined) ?? null;
}

export function getUserById(id: string): User | null {
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined) ?? null;
}

export function getUserByRole(role: User["role"]): User | null {
  return (db.prepare("SELECT * FROM users WHERE role = ? ORDER BY created_at ASC LIMIT 1").get(role) as User | undefined) ?? null;
}

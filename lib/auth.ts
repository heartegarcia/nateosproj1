import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { Role } from "./types";

export interface SessionData {
  userId?: string;
  displayName?: string;
  role?: Role;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "nate-os-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.userId) return null;
  return session;
}

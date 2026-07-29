import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { getUserByEmail } from "@/lib/users";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  let user;
  try {
    user = await getUserByEmail(email);
  } catch (err) {
    // Surfaces as a normal 500 with a real message instead of crashing the whole
    // serverless function (FUNCTION_INVOCATION_FAILED) — almost always means
    // DATABASE_URL is missing/wrong for this environment, or Supabase rejected the
    // connection. Logged so it shows up in Vercel's Function Logs.
    console.error("Login failed to reach the database:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Server error — the database is unreachable. Try again shortly." }, { status: 500 });
  }

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.displayName = user.display_name;
  session.role = user.role;
  await session.save();

  return NextResponse.json({
    ok: true,
    role: user.role,
    displayName: user.display_name,
  });
}

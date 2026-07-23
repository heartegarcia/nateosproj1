import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  redirect(session.role === "executive" ? "/dashboard" : "/action-center");
}

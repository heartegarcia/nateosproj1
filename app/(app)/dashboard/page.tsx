import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getUserByRole } from "@/lib/users";
import { ExecutiveDashboardClient } from "@/components/ExecutiveDashboardClient";

export const metadata: Metadata = { title: "Nate-ification | Nate OS" };

export default async function DashboardPage() {
  const session = await getSession();
  const nate = await getUserByRole("executive");
  return <ExecutiveDashboardClient displayName={nate?.display_name ?? "Nate"} role={session.role ?? "executive"} />;
}

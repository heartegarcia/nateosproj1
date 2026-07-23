import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listBusinesses } from "@/lib/businesses";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId || !session.role || !session.displayName) {
    redirect("/login");
  }

  const businesses = listBusinesses();

  return (
    <AppShell displayName={session.displayName} role={session.role} businesses={businesses}>
      {children}
    </AppShell>
  );
}

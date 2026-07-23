import { getSession } from "@/lib/auth";
import { listBusinesses } from "@/lib/businesses";
import { listTasks } from "@/lib/tasks";
import { BusinessesIndexClient, type BusinessSummary } from "@/components/BusinessesIndexClient";

export default async function BusinessesPage() {
  const session = await getSession();
  const businesses = listBusinesses();

  const summaries: BusinessSummary[] = businesses.map((b) => {
    const tasks = listTasks({ businessId: b.id });
    const open = tasks.filter((t) => t.status !== "completed").length;
    const overdue = tasks.filter((t) => t.is_overdue).length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    return { id: b.id, name: b.name, color: b.color, open, overdue, pct };
  });

  return <BusinessesIndexClient businesses={summaries} role={session.role ?? "executive"} />;
}

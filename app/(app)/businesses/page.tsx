import { getSession } from "@/lib/auth";
import { listBusinesses } from "@/lib/businesses";
import { listTasks } from "@/lib/tasks";
import { BusinessesIndexClient, type BusinessSummary } from "@/components/BusinessesIndexClient";

export default async function BusinessesPage() {
  const session = await getSession();
  const businesses = await listBusinesses();

  // One query for every task, grouped in memory — previously this issued a separate
  // query per business, which was cheap against local SQLite but would be N round-trips
  // to Supabase on every page load.
  const allTasks = await listTasks();
  const byBusiness = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (!byBusiness.has(t.business_id)) byBusiness.set(t.business_id, []);
    byBusiness.get(t.business_id)!.push(t);
  }

  const summaries: BusinessSummary[] = businesses.map((b) => {
    const tasks = byBusiness.get(b.id) ?? [];
    const open = tasks.filter((t) => t.status !== "completed").length;
    const overdue = tasks.filter((t) => t.is_overdue).length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    return { id: b.id, name: b.name, color: b.color, open, overdue, pct };
  });

  return <BusinessesIndexClient businesses={summaries} role={session.role ?? "executive"} />;
}

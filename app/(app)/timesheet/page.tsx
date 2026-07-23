import { getSession } from "@/lib/auth";
import { TimesheetClient } from "@/components/TimesheetClient";

export default async function TimesheetPage() {
  const session = await getSession();
  return <TimesheetClient role={session.role ?? "executive"} />;
}

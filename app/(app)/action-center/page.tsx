import { getSession } from "@/lib/auth";
import { ActionCenterClient } from "@/components/ActionCenterClient";

export default async function ActionCenterPage() {
  const session = await getSession();
  return <ActionCenterClient displayName={session.displayName ?? "there"} role={session.role ?? "admin"} />;
}

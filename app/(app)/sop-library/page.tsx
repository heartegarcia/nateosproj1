import { getSession } from "@/lib/auth";
import { SopLibraryClient } from "@/components/SopLibraryClient";

export default async function SopLibraryPage() {
  const session = await getSession();
  return <SopLibraryClient role={session.role ?? "executive"} />;
}

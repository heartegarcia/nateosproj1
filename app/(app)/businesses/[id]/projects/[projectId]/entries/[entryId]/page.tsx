import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/businesses";
import { getProjectById } from "@/lib/projects";
import { getEntryById } from "@/lib/projectEntries";
import { EntryDetailClient } from "@/components/EntryDetailClient";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string; entryId: string }>;
}) {
  const { id, projectId, entryId } = await params;
  const business = await getBusinessById(id);
  const project = await getProjectById(projectId);
  const entry = await getEntryById(entryId);
  if (!business || !project || !entry || project.business_id !== business.id || entry.project_id !== project.id) {
    notFound();
  }

  const session = await getSession();

  return (
    <EntryDetailClient
      key={entry.id}
      business={business}
      project={project}
      initialEntry={entry}
      role={session.role ?? "executive"}
    />
  );
}

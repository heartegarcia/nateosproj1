import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/businesses";
import { getProjectById } from "@/lib/projects";
import { ProjectDetailClient } from "@/components/ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const business = getBusinessById(id);
  const project = getProjectById(projectId);
  if (!business || !project || project.business_id !== business.id) notFound();

  const parentProject = project.parent_project_id ? getProjectById(project.parent_project_id) : null;

  const session = await getSession();

  return (
    <ProjectDetailClient
      business={business}
      project={project}
      parentProject={parentProject}
      role={session.role ?? "executive"}
    />
  );
}

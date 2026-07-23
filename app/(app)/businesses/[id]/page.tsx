import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/businesses";
import { BusinessDetailClient } from "@/components/BusinessDetailClient";

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = getBusinessById(id);
  if (!business) notFound();

  const session = await getSession();

  return <BusinessDetailClient business={business} role={session.role ?? "executive"} />;
}

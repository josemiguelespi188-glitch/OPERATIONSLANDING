import { CommunicationDetail } from "@/components/admin/communications/CommunicationDetail";

export default async function CommunicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommunicationDetail id={id} />;
}

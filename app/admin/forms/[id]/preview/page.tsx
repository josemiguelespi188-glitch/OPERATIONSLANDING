import { RequestTypePreview } from "@/components/admin/formbuilder/RequestTypePreview";

export default async function RequestTypePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestTypePreview id={id} />;
}

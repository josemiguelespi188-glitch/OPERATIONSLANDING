import { DocumentTemplateWorkspace } from "@/components/admin/documentGenerator/DocumentTemplateWorkspace";

export default async function RequestTypeDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentTemplateWorkspace requestTypeId={id} />;
}

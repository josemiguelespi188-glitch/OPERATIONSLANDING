import { RequestTypeEditor } from "@/components/admin/formbuilder/RequestTypeEditor";

export default async function RequestTypeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestTypeEditor id={id} />;
}

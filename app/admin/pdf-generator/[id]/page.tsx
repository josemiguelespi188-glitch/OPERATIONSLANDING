import { PdfTemplateWorkspace } from "@/components/admin/pdfgenerator/PdfTemplateWorkspace";

export default async function PdfTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PdfTemplateWorkspace id={id} />;
}

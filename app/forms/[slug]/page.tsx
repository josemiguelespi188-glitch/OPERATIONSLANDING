import { notFound } from "next/navigation";
import { DetailedRequestForm } from "@/components/forms/DetailedRequestForm";
import { getRequestFormConfig } from "@/lib/requestFormConfigs";

export default async function RequestFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = getRequestFormConfig(slug);

  if (!config) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <DetailedRequestForm config={config} />
    </main>
  );
}

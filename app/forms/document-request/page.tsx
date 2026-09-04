import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { documentRequestSpec } from "@/lib/formSpecs/documentRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Documentation Request | AxisKey",
};

export default async function DocumentRequestPage() {
  const overrides = await loadFormOverrides("document-request");
  const { fields, submissionMapping } = mergePublicFields(documentRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="document-request"
      title={documentRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : documentRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { customRequestSpec } from "@/lib/formSpecs/customRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Custom Request | AxisKey",
};

export default async function CustomRequestPage() {
  const overrides = await loadFormOverrides("custom-request");
  const { fields, submissionMapping } = mergePublicFields(customRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="custom-request"
      title={customRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : customRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

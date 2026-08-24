import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { iraFundingRequestSpec } from "@/lib/formSpecs/iraFundingRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IRA Funding Request | AxisKey",
};

export default async function IraFundingRequestPage() {
  const overrides = await loadFormOverrides("ira-funding-request");
  const { fields, submissionMapping } = mergePublicFields(iraFundingRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="ira-funding-request"
      title={iraFundingRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : iraFundingRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

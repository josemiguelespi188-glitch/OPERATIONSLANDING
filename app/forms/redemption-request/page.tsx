import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { redemptionRequestSpec } from "@/lib/formSpecs/redemptionRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Redemption Request | AxisKey",
};

export default async function RedemptionRequestPage() {
  const overrides = await loadFormOverrides("redemption-request");
  const { fields, submissionMapping } = mergePublicFields(redemptionRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="redemption-request"
      title={redemptionRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : redemptionRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

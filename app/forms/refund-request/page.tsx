import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { refundRequestSpec } from "@/lib/formSpecs/refundRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refund Request | AxisKey",
};

export default async function RefundRequestPage() {
  const overrides = await loadFormOverrides("refund-request");
  const { fields, submissionMapping } = mergePublicFields(refundRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="refund-request"
      title={refundRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : refundRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

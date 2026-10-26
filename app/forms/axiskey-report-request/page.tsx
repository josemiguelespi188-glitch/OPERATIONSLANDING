import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { axiskeyReportRequestSpec } from "@/lib/formSpecs/axiskeyReportRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request an AxisKey Report | AxisKey",
};

export default async function AxisKeyReportRequestPage() {
  const overrides = await loadFormOverrides("axiskey-report-request");
  if (!overrides.isActive) notFound();
  const { fields, submissionMapping } = mergePublicFields(axiskeyReportRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="axiskey-report-request"
      title={axiskeyReportRequestSpec.title}
      descriptionParagraphs={
        overrides.description ? [overrides.description] : axiskeyReportRequestSpec.descriptionParagraphs
      }
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

import type { Metadata } from "next";
import { SideLetterRequestForm } from "@/components/axiskey-forms/SideLetterRequestForm";
import { sideLetterRequestSpec } from "@/lib/formSpecs/sideLetterRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Side Letter Request | AxisKey",
};

export default async function SideLetterRequestPage() {
  const overrides = await loadFormOverrides("side-letter-request");
  const { fields, submissionMapping } = mergePublicFields(sideLetterRequestSpec, overrides.fields);

  return (
    <SideLetterRequestForm
      title={sideLetterRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : sideLetterRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

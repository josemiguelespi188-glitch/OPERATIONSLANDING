import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
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
    <FormShell
      slug="side-letter-request"
      title={sideLetterRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : sideLetterRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

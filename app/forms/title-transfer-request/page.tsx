import type { Metadata } from "next";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { titleTransferRequestSpec } from "@/lib/formSpecs/titleTransferRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

// Fields/copy can be edited from the admin Form Builder — always fetch the
// latest overrides instead of caching a build-time snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Title Transfer Request | AxisKey",
};

export default async function TitleTransferRequestPage() {
  const overrides = await loadFormOverrides("title-transfer-request");
  const { fields, submissionMapping } = mergePublicFields(titleTransferRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="title-transfer-request"
      title={titleTransferRequestSpec.title}
      descriptionParagraphs={overrides.description ? [overrides.description] : titleTransferRequestSpec.descriptionParagraphs}
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}

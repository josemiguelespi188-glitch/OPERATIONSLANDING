import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormShell } from "@/components/axiskey-forms/FormShell";
import { transferAgreementRequestSpec } from "@/lib/formSpecs/transferAgreementRequest";
import { loadFormOverrides } from "@/lib/formSpecs/loadOverrides";
import { mergePublicFields } from "@/lib/dynamicForms/fieldConfigBridge";

// Fields/copy can be edited from the admin Form Builder — always fetch the
// latest overrides instead of caching a build-time snapshot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transfer Agreement Request | AxisKey",
};

export default async function TransferAgreementRequestPage() {
  const overrides = await loadFormOverrides("transfer-agreement-request");
  if (!overrides.isActive) notFound();
  const { fields, submissionMapping } = mergePublicFields(transferAgreementRequestSpec, overrides.fields);

  return (
    <FormShell
      slug="transfer-agreement-request"
      title={transferAgreementRequestSpec.title}
      descriptionParagraphs={
        overrides.description ? [overrides.description] : transferAgreementRequestSpec.descriptionParagraphs
      }
      fields={fields}
      submissionMapping={submissionMapping}
    />
  );
}
